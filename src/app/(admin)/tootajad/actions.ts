"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { parseEuroToCents } from "@/lib/money";
import { addDaysIso, toMinutes, zonedDateTime } from "@/lib/time";
import type { FormState } from "@/components/ui/form";
import { canAddStaff, staffLimitMessage } from "@/lib/plans";
import { activeStaffCount } from "@/server/plans";

async function ownStaff(businessId: string, staffId: string) {
  const m = await db.query.staffMembers.findFirst({ where: and(eq(s.staffMembers.id, staffId), eq(s.staffMembers.businessId, businessId)) });
  if (!m) throw new Error("Töötajat ei leitud");
  return m;
}

const profileSchema = z.object({
  name: z.string().trim().min(2, "Sisesta nimi").max(80),
  title: z.string().trim().max(60).optional().transform((v) => v || null),
  email: z.union([z.literal(""), z.email("Vigane e-post")]).optional().transform((v) => v || null),
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  bio: z.string().trim().max(600).optional().transform((v) => v || null),
  bookableOnline: z.literal("on").optional(),
  active: z.literal("on").optional(),
});

export async function saveProfile(staffId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireSession();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Kontrolli välju.", errors: z.flattenError(parsed.error).fieldErrors };
  const values = { ...parsed.data, bookableOnline: parsed.data.bookableOnline === "on", active: staffId ? parsed.data.active === "on" : true };

  if (staffId) {
    const current = await ownStaff(business.id, staffId);
    // uuesti aktiveerimine loeb paketi töötajate piiri sisse
    if (values.active && !current.active && !canAddStaff(business.plan, await activeStaffCount(business.id))) {
      return { message: staffLimitMessage(business.plan) };
    }
    await db.update(s.staffMembers).set(values).where(eq(s.staffMembers.id, staffId));
    revalidatePath("/tootajad");
    return { ok: true, message: "Salvestatud." };
  }

  if (!canAddStaff(business.plan, await activeStaffCount(business.id))) {
    return { message: staffLimitMessage(business.plan) };
  }

  // uus töötaja saab ettevõtte lahtiolekuajad vaikegraafikuks
  const id = await db.transaction(async (tx) => {
    const count = await tx.$count(s.staffMembers, eq(s.staffMembers.businessId, business.id));
    const [m] = await tx.insert(s.staffMembers).values({ ...values, businessId: business.id, sortOrder: count }).returning();
    const hours = await tx.query.openingHours.findMany({ where: eq(s.openingHours.businessId, business.id) });
    const rows = hours
      .filter((h) => !h.closed && h.startTime && h.endTime && h.weekday <= 5)
      .map((h) => ({ staffId: m.id, validFrom: "2000-01-01", weekday: h.weekday, startTime: h.startTime!, endTime: h.endTime!, breaks: [] }));
    if (rows.length) await tx.insert(s.workSchedules).values(rows);
    return m.id;
  });
  revalidatePath("/tootajad");
  redirect(`/tootajad/${id}?tab=tooaeg`);
}

// ---------- Tööaeg ----------

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
const weekSchema = z.object({
  validFrom: z.iso.date("Vali kuupäev"),
  days: z
    .array(
      z.object({
        weekday: z.number().int().min(1).max(7),
        enabled: z.boolean(),
        intervals: z.array(z.object({ start: z.string().regex(timeRe), end: z.string().regex(timeRe) })),
      }),
    )
    .length(7),
});

export type WeekInput = z.infer<typeof weekSchema>;

/** Valideerib päeva vahemikud: algus < lõpp, ei kattu. Tagastab vea või null. */
function validateDay(intervals: { start: string; end: string }[]): string | null {
  const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) >= toMinutes(sorted[i].end)) return "Algus peab olema enne lõppu";
    if (i > 0 && toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) return "Vahemikud kattuvad";
  }
  return null;
}

/**
 * Salvestab nädalagraafiku, mis kehtib alates validFrom.
 * Varasemad read lõpetatakse päev enne; sama või hilisema algusega read asendatakse.
 */
export async function saveWeek(staffId: string, input: WeekInput): Promise<FormState> {
  const { business } = await requireSession();
  await ownStaff(business.id, staffId);
  const parsed = weekSchema.safeParse(input);
  if (!parsed.success) return { message: "Kontrolli kellaaegu." };

  for (const d of parsed.data.days) {
    if (d.enabled && d.intervals.length === 0) return { message: "Lisa tööpäevale vähemalt üks vahemik või lülita päev välja." };
    const err = d.enabled ? validateDay(d.intervals) : null;
    if (err) return { message: `${["Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede", "Laupäev", "Pühapäev"][d.weekday - 1]}: ${err}` };
  }

  const { validFrom, days } = parsed.data;
  await db.transaction(async (tx) => {
    await tx.delete(s.workSchedules).where(and(eq(s.workSchedules.staffId, staffId), gte(s.workSchedules.validFrom, validFrom)));
    await tx
      .update(s.workSchedules)
      .set({ validTo: addDaysIso(validFrom, -1) })
      .where(and(eq(s.workSchedules.staffId, staffId), lt(s.workSchedules.validFrom, validFrom), isNull(s.workSchedules.validTo)));
    const rows = days
      .filter((d) => d.enabled)
      .map((d) => {
        const sorted = [...d.intervals].sort((a, b) => a.start.localeCompare(b.start));
        // vahemike vahed → vaheajad
        const breaks = sorted.slice(1).map((iv, i) => ({ start: sorted[i].end, end: iv.start, label: "Lõunapaus" }));
        return { staffId, validFrom, weekday: d.weekday, startTime: sorted[0].start, endTime: sorted.at(-1)!.end, breaks };
      });
    if (rows.length) await tx.insert(s.workSchedules).values(rows);
  });
  revalidatePath(`/tootajad/${staffId}`);
  revalidatePath("/tootajad");
  revalidatePath("/kalender");
  return { ok: true, message: "Tööaeg salvestatud." };
}

// ---------- Puudumised ----------

const timeOffSchema = z
  .object({
    type: z.enum(["VACATION", "TRAINING", "SICK", "OTHER"]),
    note: z.string().trim().max(80).optional().transform((v) => v || null),
    fromDate: z.iso.date("Vali algus"),
    toDate: z.iso.date("Vali lõpp"),
    allDay: z.literal("on").optional(),
    fromTime: z.string().optional(),
    toTime: z.string().optional(),
  })
  .refine((d) => d.toDate >= d.fromDate, { path: ["toDate"], message: "Lõpp peab olema pärast algust" });

export async function addTimeOff(staffId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireSession();
  await ownStaff(business.id, staffId);
  const parsed = timeOffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  const tz = business.timezone;
  const allDay = d.allDay === "on" || !d.fromTime || !d.toTime;
  const startsAt = zonedDateTime(d.fromDate, allDay ? "00:00" : d.fromTime!, tz);
  const endsAt = allDay ? zonedDateTime(addDaysIso(d.toDate, 1), "00:00", tz) : zonedDateTime(d.toDate, d.toTime!, tz);
  if (endsAt <= startsAt) return { errors: { toTime: ["Lõpp peab olema pärast algust"] } };

  await db.insert(s.timeOff).values({ staffId, type: d.type, note: d.note, startsAt, endsAt });
  revalidatePath(`/tootajad/${staffId}`);
  revalidatePath("/kalender");
  return { ok: true, message: "Erand lisatud." };
}

export async function deleteTimeOff(staffId: string, timeOffId: string) {
  const { business } = await requireSession();
  await ownStaff(business.id, staffId);
  await db.delete(s.timeOff).where(and(eq(s.timeOff.id, timeOffId), eq(s.timeOff.staffId, staffId)));
  revalidatePath(`/tootajad/${staffId}`);
  revalidatePath("/kalender");
}

// ---------- Teenused ----------

export async function saveStaffServices(staffId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireSession();
  await ownStaff(business.id, staffId);
  const ids = formData.getAll("service").map(String);
  const own = ids.length
    ? await db
        .select({ id: s.services.id, price: s.services.priceCents, dur: s.services.durationMinutes })
        .from(s.services)
        .where(and(eq(s.services.businessId, business.id), inArray(s.services.id, ids)))
    : [];
  await db.transaction(async (tx) => {
    await tx.delete(s.staffServices).where(eq(s.staffServices.staffId, staffId));
    if (own.length)
      await tx.insert(s.staffServices).values(
        own.map((sv) => {
          const price = parseEuroToCents(formData.get(`price_${sv.id}`));
          const dur = Number(formData.get(`duration_${sv.id}`)) || null;
          return {
            staffId,
            serviceId: sv.id,
            priceCents: price !== null && price !== sv.price ? price : null,
            durationMinutes: dur !== null && dur !== sv.dur ? dur : null,
          };
        }),
      );
  });
  revalidatePath(`/tootajad/${staffId}`);
  revalidatePath("/teenused");
  return { ok: true, message: "Teenused salvestatud." };
}
