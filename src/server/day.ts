import "server-only";
import { and, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { addDaysIso, isoWeekday, localDate, localMinutes, toMinutes, zonedDateTime } from "@/lib/time";
import { estonianHolidays } from "@/lib/holidays-ee";
import { staffDay, totalMinutes, subtract, type Interval, type StaffDay } from "@/lib/schedule";

export type DayBooking = {
  id: string;
  number: string;
  start: number;
  end: number;
  startsAt: Date;
  status: (typeof s.bookingStatusEnum.enumValues)[number];
  source: (typeof s.bookingSourceEnum.enumValues)[number];
  clientName: string;
  serviceName: string;
  durationMinutes: number;
  categoryColor: string;
  categoryName: string;
  staffId: string;
  finalPriceCents: number;
  bufferBefore: number;
  bufferAfter: number;
};

export type StaffColumn = {
  id: string;
  name: string;
  color: string;
  day: StaffDay;
  bookings: DayBooking[];
  /** Broneeritud minutid / töö minutid */
  utilization: number;
  /** Kui puudub terve päeva: puudumise algus ja lõpp (kohalikud kuupäevad, lõpp kaasa arvatud) */
  absence?: { from: string; to: string; note?: string };
};

const ACTIVE_STATUSES = ["HELD", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "NO_SHOW"] as const;
export const isActiveStatus = (st: DayBooking["status"]) => (ACTIVE_STATUSES as readonly string[]).includes(st);

/** Kõik ühe päeva andmed kalendri ja töölaua jaoks */
export async function loadDay(businessId: string, isoDate: string, tz: string) {
  const dayStart = zonedDateTime(isoDate, "00:00", tz);
  const dayEnd = zonedDateTime(addDaysIso(isoDate, 1), "00:00", tz);

  const [staff, opening, holiday, bookingRows] = await Promise.all([
    db.query.staffMembers.findMany({
      where: and(eq(s.staffMembers.businessId, businessId), eq(s.staffMembers.active, true)),
      orderBy: [asc(s.staffMembers.sortOrder)],
      with: { schedules: true, timeOff: { where: and(lt(s.timeOff.startsAt, dayEnd), gte(s.timeOff.endsAt, dayStart)) } },
    }),
    db.query.openingHours.findFirst({
      where: and(eq(s.openingHours.businessId, businessId), eq(s.openingHours.weekday, isoWeekday(isoDate))),
    }),
    db.query.holidays.findFirst({ where: and(eq(s.holidays.businessId, businessId), eq(s.holidays.date, isoDate)) }),
    db
      .select({
        b: s.bookings,
        clientName: s.clients.name,
        serviceName: s.services.name,
        durationMinutes: s.services.durationMinutes,
        bufferBefore: s.services.bufferBeforeMinutes,
        categoryColor: s.serviceCategories.color,
        categoryName: s.serviceCategories.name,
      })
      .from(s.bookings)
      .innerJoin(s.clients, eq(s.clients.id, s.bookings.clientId))
      .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
      .leftJoin(s.serviceCategories, eq(s.serviceCategories.id, s.services.categoryId))
      .where(and(eq(s.bookings.businessId, businessId), gte(s.bookings.startsAt, dayStart), lt(s.bookings.startsAt, dayEnd)))
      .orderBy(asc(s.bookings.startsAt)),
  ]);

  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId), columns: { useNationalHolidays: true } });
  const national = business?.useNationalHolidays ? estonianHolidays(Number(isoDate.slice(0, 4))).find((h) => h.date === isoDate) : undefined;

  const openInterval = openingFor(opening, holiday, national);

  const bookings: DayBooking[] = bookingRows.map(({ b, ...rest }) => ({
    id: b.id,
    number: b.number,
    start: localMinutes(b.startsAt, tz),
    end: localMinutes(b.endsAt, tz),
    startsAt: b.startsAt,
    status: b.status,
    source: b.source,
    staffId: b.staffId,
    finalPriceCents: b.finalPriceCents,
    bufferBefore: rest.bufferBefore,
    bufferAfter: b.bufferMinutes,
    clientName: rest.clientName,
    serviceName: rest.serviceName,
    durationMinutes: rest.durationMinutes,
    categoryColor: rest.categoryColor ?? "#6b7280",
    categoryName: rest.categoryName ?? "",
  }));

  const columns: StaffColumn[] = staff.map((m) => {
    const absences = m.timeOff.map((t) => ({
      start: Math.max(0, Math.round((t.startsAt.getTime() - dayStart.getTime()) / 60_000)),
      end: Math.min(24 * 60, Math.round((t.endsAt.getTime() - dayStart.getTime()) / 60_000)),
      note: t.note ?? undefined,
    }));
    const day = staffDay(
      m.schedules.map((r) => ({ ...r, breaks: r.breaks ?? [] })),
      isoDate,
      absences,
      openInterval,
    );
    const own = bookings.filter((b) => b.staffId === m.id);
    const busy = own.filter((b) => isActiveStatus(b.status)).map((b) => ({ start: b.start, end: b.end }));
    const workMin = totalMinutes(day.working);
    const freeMin = totalMinutes(subtract(day.working, busy));
    const full = m.timeOff[0];
    return {
      absence:
        day.absent && full
          ? { from: localDate(full.startsAt, tz), to: localDate(new Date(full.endsAt.getTime() - 1), tz), note: full.note ?? undefined }
          : undefined,
      id: m.id,
      name: m.name,
      color: m.color,
      day,
      bookings: own,
      utilization: workMin > 0 ? (workMin - freeMin) / workMin : 0,
    };
  });

  return { isoDate, opening: openInterval, columns, bookings, holidayName: holiday?.name ?? national?.name };
}

/** Ühe perioodi broneeringute koondnäitajad */
export async function periodStats(businessId: string, from: Date, to: Date) {
  const rows = await db
    .select({ status: s.bookings.status, price: s.bookings.finalPriceCents, clientId: s.bookings.clientId })
    .from(s.bookings)
    .where(and(eq(s.bookings.businessId, businessId), gte(s.bookings.startsAt, from), lt(s.bookings.startsAt, to), ne(s.bookings.status, "CANCELLED")));
  const revenue = rows.filter((r) => r.status === "COMPLETED" || r.status === "CONFIRMED").reduce((a, r) => a + r.price, 0);
  return { count: rows.length, revenue, clientIds: [...new Set(rows.map((r) => r.clientId))] };
}

/** Mitu klienti antud nimekirjast broneeris esimest korda enne kuupäeva `before` mitte kunagi */
export async function countNewClients(businessId: string, clientIds: string[], before: Date) {
  if (clientIds.length === 0) return 0;
  const earlier = await db
    .selectDistinct({ clientId: s.bookings.clientId })
    .from(s.bookings)
    .where(and(eq(s.bookings.businessId, businessId), inArray(s.bookings.clientId, clientIds), lt(s.bookings.startsAt, before)));
  return clientIds.length - earlier.length;
}

type OpeningRow = { closed: boolean; startTime: string | null; endTime: string | null } | undefined;
type HolidayRow = { closed: boolean; startTime: string | null; endTime: string | null } | undefined;

/** Päeva lahtiolekuaeg: undefined = pole määratud, null = suletud */
export function openingFor(opening: OpeningRow, holiday: HolidayRow, national: { kind: string } | undefined): Interval | null | undefined {
  if (holiday) {
    // ettevõtte enda erand on ülimuslik
    return holiday.closed || !holiday.startTime || !holiday.endTime ? null : { start: toMinutes(holiday.startTime), end: toMinutes(holiday.endTime) };
  }
  if (opening?.closed || national?.kind === "closed") return null;
  if (opening?.startTime && opening.endTime) {
    const iv = { start: toMinutes(opening.startTime), end: toMinutes(opening.endTime) };
    // lühendatud tööpäev: 3 tundi varem kinni
    return national?.kind === "short" ? { start: iv.start, end: Math.max(iv.start, iv.end - 180) } : iv;
  }
  return undefined;
}
