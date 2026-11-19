import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { addDaysIso, isoWeekday, localDate, localMinutes, zonedDateTime } from "@/lib/time";
import { estonianHolidays } from "@/lib/holidays-ee";
import { staffDay, type Interval } from "@/lib/schedule";
import { openingFor } from "./day";

export type RangeBooking = {
  id: string;
  date: string;
  start: number;
  end: number;
  status: (typeof s.bookingStatusEnum.enumValues)[number];
  clientName: string;
  serviceName: string;
  categoryColor: string;
  staffId: string;
  staffName: string;
  staffColor: string;
};

export type RangeDay = {
  date: string;
  /** salongi lahtiolek: null = suletud, undefined = määramata */
  opening: Interval | null | undefined;
  holidayName?: string;
  /** kui vaadatakse ühte töötajat: tema tööaeg sel päeval */
  shift?: Interval | null;
  breaks?: (Interval & { label: string })[];
  absent?: boolean;
};

/** Mitme päeva (nädal/kuu) broneeringud ja lahtiolekuajad ühe päringupaketiga */
export async function loadRange(businessId: string, fromIso: string, days: number, tz: string, staffId?: string | null) {
  const toIso = addDaysIso(fromIso, days);
  const from = zonedDateTime(fromIso, "00:00", tz);
  const to = zonedDateTime(toIso, "00:00", tz);

  const [business, opening, holidays, rows, staff] = await Promise.all([
    db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId), columns: { useNationalHolidays: true } }),
    db.query.openingHours.findMany({ where: eq(s.openingHours.businessId, businessId) }),
    db.query.holidays.findMany({ where: and(eq(s.holidays.businessId, businessId), gte(s.holidays.date, fromIso), lt(s.holidays.date, toIso)) }),
    db
      .select({
        b: s.bookings,
        clientName: s.clients.name,
        serviceName: s.services.name,
        categoryColor: s.serviceCategories.color,
        staffName: s.staffMembers.name,
        staffColor: s.staffMembers.color,
      })
      .from(s.bookings)
      .innerJoin(s.clients, eq(s.clients.id, s.bookings.clientId))
      .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
      .innerJoin(s.staffMembers, eq(s.staffMembers.id, s.bookings.staffId))
      .leftJoin(s.serviceCategories, eq(s.serviceCategories.id, s.services.categoryId))
      .where(and(eq(s.bookings.businessId, businessId), gte(s.bookings.startsAt, from), lt(s.bookings.startsAt, to), ...(staffId ? [eq(s.bookings.staffId, staffId)] : [])))
      .orderBy(asc(s.bookings.startsAt)),
    staffId
      ? db.query.staffMembers.findFirst({
          where: and(eq(s.staffMembers.id, staffId), eq(s.staffMembers.businessId, businessId)),
          with: { schedules: true, timeOff: { where: and(lt(s.timeOff.startsAt, to), gte(s.timeOff.endsAt, from)) } },
        })
      : Promise.resolve(undefined),
  ]);

  const years = new Set([Number(fromIso.slice(0, 4)), Number(toIso.slice(0, 4))]);
  const national = business?.useNationalHolidays ? [...years].flatMap((y) => estonianHolidays(y)) : [];

  const dayList: RangeDay[] = Array.from({ length: days }, (_, i) => {
    const date = addDaysIso(fromIso, i);
    const nat = national.find((h) => h.date === date);
    const hol = holidays.find((h) => h.date === date);
    const open = openingFor(
      opening.find((o) => o.weekday === isoWeekday(date)),
      hol,
      nat,
    );
    const day: RangeDay = { date, opening: open, holidayName: hol?.name ?? nat?.name };
    if (staff) {
      const dayStart = zonedDateTime(date, "00:00", tz);
      const absences = staff.timeOff
        .filter((t) => t.startsAt < new Date(dayStart.getTime() + 86_400_000) && t.endsAt > dayStart)
        .map((t) => ({
          start: Math.max(0, Math.round((t.startsAt.getTime() - dayStart.getTime()) / 60_000)),
          end: Math.min(24 * 60, Math.round((t.endsAt.getTime() - dayStart.getTime()) / 60_000)),
        }));
      const sd = staffDay(staff.schedules.map((r) => ({ ...r, breaks: r.breaks ?? [] })), date, absences, open);
      day.shift = sd.shift ?? null;
      day.breaks = sd.breaks;
      day.absent = sd.absent;
    }
    return day;
  });

  const bookings: RangeBooking[] = rows.map((r) => ({
    id: r.b.id,
    date: localDate(r.b.startsAt, tz),
    start: localMinutes(r.b.startsAt, tz),
    end: localMinutes(r.b.endsAt, tz) || 24 * 60,
    status: r.b.status,
    clientName: r.clientName,
    serviceName: r.serviceName,
    categoryColor: r.categoryColor ?? "#6b7280",
    staffId: r.b.staffId,
    staffName: r.staffName,
    staffColor: r.staffColor,
  }));

  return { days: dayList, bookings };
}
