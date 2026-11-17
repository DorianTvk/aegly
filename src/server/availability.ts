import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { availableSlots, busyInterval, type Slot } from "@/lib/availability";
import { addDaysIso, localDate, localMinutes, todayIso } from "@/lib/time";
import { isActiveStatus, loadDay } from "./day";

export type SlotResult = { slots: Slot[]; reason?: "closed" | "too-far" | "past" | "no-staff" };

/**
 * Vabad algusajad teenusele kindlal päeval.
 * @param staffId konkreetne töötaja või null = "Ükskõik kes"
 * @param opts.ignoreLead halduspaneeli käsitsi broneeringul min etteteatamisaeg ei kehti
 */
export async function getSlots(
  businessId: string,
  serviceId: string,
  staffId: string | null,
  isoDate: string,
  opts: { ignoreLead?: boolean; now?: Date } = {},
): Promise<SlotResult> {
  const [business, service] = await Promise.all([
    db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) }),
    db.query.services.findFirst({
      where: and(eq(s.services.id, serviceId), eq(s.services.businessId, businessId)),
      with: { staff: true },
    }),
  ]);
  if (!business || !service) return { slots: [] };

  const tz = business.timezone;
  const now = opts.now ?? new Date();
  const today = todayIso(tz);
  if (isoDate < today) return { slots: [], reason: "past" };
  const maxAdvance = service.maxAdvanceDays ?? business.maxAdvanceDays;
  if (!opts.ignoreLead && isoDate > addDaysIso(today, maxAdvance)) return { slots: [], reason: "too-far" };

  const allowed = new Map(service.staff.map((l) => [l.staffId, l]));
  if (staffId && !allowed.has(staffId)) return { slots: [], reason: "no-staff" };

  const day = await loadDay(businessId, isoDate, tz);
  if (day.opening === null) return { slots: [], reason: "closed" };

  // min etteteatamisaeg (võib ulatuda järgmistesse päevadesse)
  const lead = opts.ignoreLead ? 0 : (service.minLeadMinutes ?? business.minLeadMinutes);
  const leadEnd = new Date(now.getTime() + lead * 60_000);
  const leadDate = localDate(leadEnd, tz);
  if (leadDate > isoDate) return { slots: [], reason: "past" };
  const earliestStart = leadDate === isoDate ? localMinutes(leadEnd, tz) : null;

  const inputs = day.columns
    .filter((c) => (staffId ? c.id === staffId : allowed.has(c.id)))
    .map((c) => ({
      staffId: c.id,
      day: c.day,
      durationMinutes: allowed.get(c.id)?.durationMinutes ?? null,
      busy: c.bookings
        .filter((b) => isActiveStatus(b.status))
        .map((b) => busyInterval({ start: b.start, end: b.end, bufferBefore: b.bufferBefore, bufferAfter: b.bufferAfter })),
    }));
  if (inputs.length === 0) return { slots: [], reason: "no-staff" };

  const slots = availableSlots(inputs, {
    durationMinutes: service.durationMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferMinutes,
    stepMinutes: business.slotStepMinutes,
    earliestStart,
  });
  return { slots };
}
