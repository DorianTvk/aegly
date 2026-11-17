import "server-only";
import { and, asc, eq, gte, lt, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { staffDay, subtract, totalMinutes } from "@/lib/schedule";
import { addDaysIso, isoWeekday, localDate, localMinutes, toMinutes, zonedDateTime } from "@/lib/time";
import { estonianHolidays } from "@/lib/holidays-ee";

export type Period = "week" | "month" | "quarter" | "year";

/** Perioodi algus ja lõpp (lõpp välja arvatud) kohalike kuupäevadena */
export function periodRange(period: Period, today: string, offset = 0): { from: string; to: string; label: string } {
  const [y, m] = today.split("-").map(Number);
  if (period === "week") {
    const monday = addDaysIso(today, 1 - isoWeekday(today) + offset * 7);
    return { from: monday, to: addDaysIso(monday, 7), label: `Nädal ${monday.slice(8)}.${monday.slice(5, 7)}` };
  }
  if (period === "month") {
    const d = new Date(Date.UTC(y, m - 1 + offset, 1));
    const e = new Date(Date.UTC(y, m + offset, 1));
    const names = ["Jaanuar", "Veebruar", "Märts", "Aprill", "Mai", "Juuni", "Juuli", "August", "September", "Oktoober", "November", "Detsember"];
    return { from: d.toISOString().slice(0, 10), to: e.toISOString().slice(0, 10), label: `${names[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  }
  if (period === "quarter") {
    const q = Math.floor((m - 1) / 3) + offset;
    const d = new Date(Date.UTC(y, q * 3, 1));
    const e = new Date(Date.UTC(y, q * 3 + 3, 1));
    return { from: d.toISOString().slice(0, 10), to: e.toISOString().slice(0, 10), label: `${Math.floor(d.getUTCMonth() / 3) + 1}. kvartal ${d.getUTCFullYear()}` };
  }
  const d = new Date(Date.UTC(y + offset, 0, 1));
  return { from: d.toISOString().slice(0, 10), to: new Date(Date.UTC(y + offset + 1, 0, 1)).toISOString().slice(0, 10), label: String(y + offset) };
}

/** Kõik aruande andmed perioodi kohta – üks kord päringud, arvutus mälus */
export async function periodReport(businessId: string, tz: string, from: string, to: string) {
  const start = zonedDateTime(from, "00:00", tz);
  const end = zonedDateTime(to, "00:00", tz);
  const [business, bookings, staff, opening, holidays, gifts] = await Promise.all([
    db.query.businesses.findFirst({ where: eq(s.businesses.id, businessId) }),
    db
      .select({
        b: s.bookings,
        serviceName: s.services.name,
        staffName: s.staffMembers.name,
        staffColor: s.staffMembers.color,
      })
      .from(s.bookings)
      .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
      .innerJoin(s.staffMembers, eq(s.staffMembers.id, s.bookings.staffId))
      .where(and(eq(s.bookings.businessId, businessId), gte(s.bookings.startsAt, start), lt(s.bookings.startsAt, end), ne(s.bookings.status, "CANCELLED"))),
    db.query.staffMembers.findMany({ where: and(eq(s.staffMembers.businessId, businessId), eq(s.staffMembers.active, true)), orderBy: [asc(s.staffMembers.sortOrder)], with: { schedules: true, timeOff: true } }),
    db.query.openingHours.findMany({ where: eq(s.openingHours.businessId, businessId) }),
    db.query.holidays.findMany({ where: eq(s.holidays.businessId, businessId) }),
    db.query.giftCards.findMany({ where: and(eq(s.giftCards.businessId, businessId), gte(s.giftCards.createdAt, start), lt(s.giftCards.createdAt, end)) }),
  ]);

  const counted = bookings.filter((x) => x.b.status === "COMPLETED" || x.b.status === "CONFIRMED");
  const revenue = counted.reduce((a, x) => a + x.b.finalPriceCents, 0);
  const giftRevenue = gifts.reduce((a, g) => a + g.valueCents, 0);
  const noShows = bookings.filter((x) => x.b.status === "NO_SHOW").length;

  // Täituvus: broneeritud minutid / tööminutid (päev päeva haaval, graafikute põhjal)
  const national = business?.useNationalHolidays
    ? new Map([...new Set([from.slice(0, 4), to.slice(0, 4)])].flatMap((y) => estonianHolidays(Number(y))).map((h) => [h.date, h]))
    : new Map();
  const ownHolidays = new Map(holidays.map((h) => [h.date, h]));
  const openByWd = new Map(opening.map((o) => [o.weekday, o]));
  const perStaff = new Map<string, { work: number; booked: number }>();
  const lastDay = addDaysIso(to, -1);
  for (let d = from; d <= lastDay; d = addDaysIso(d, 1)) {
    const o = openByWd.get(isoWeekday(d));
    const own = ownHolidays.get(d);
    const nat = national.get(d);
    let open: { start: number; end: number } | null | undefined;
    if (own) open = own.closed || !own.startTime || !own.endTime ? null : { start: toMinutes(own.startTime), end: toMinutes(own.endTime) };
    else if (o?.closed || nat?.kind === "closed") open = null;
    else if (o?.startTime && o.endTime) open = { start: toMinutes(o.startTime), end: nat?.kind === "short" ? toMinutes(o.endTime) - 180 : toMinutes(o.endTime) };
    const dayStart = zonedDateTime(d, "00:00", tz).getTime();
    for (const m of staff) {
      const abs = m.timeOff
        .filter((t) => t.startsAt.getTime() < dayStart + 86_400_000 && t.endsAt.getTime() > dayStart)
        .map((t) => ({ start: Math.max(0, (t.startsAt.getTime() - dayStart) / 60_000), end: Math.min(1440, (t.endsAt.getTime() - dayStart) / 60_000) }));
      const day = staffDay(m.schedules.map((r) => ({ ...r, breaks: r.breaks ?? [] })), d, abs, open);
      const busy = counted
        .filter((x) => x.b.staffId === m.id && localDate(x.b.startsAt, tz) === d)
        .map((x) => ({ start: localMinutes(x.b.startsAt, tz), end: localMinutes(x.b.endsAt, tz) }));
      const work = totalMinutes(day.working);
      const free = totalMinutes(subtract(day.working, busy));
      const acc = perStaff.get(m.id) ?? { work: 0, booked: 0 };
      acc.work += work;
      acc.booked += work - free;
      perStaff.set(m.id, acc);
    }
  }
  const totalWork = [...perStaff.values()].reduce((a, x) => a + x.work, 0);
  const totalBooked = [...perStaff.values()].reduce((a, x) => a + x.booked, 0);

  return {
    revenue,
    giftRevenue,
    count: bookings.length,
    countedCount: counted.length,
    avgTicket: counted.length ? Math.round(revenue / counted.length) : 0,
    noShowRate: bookings.length ? noShows / bookings.length : 0,
    utilization: totalWork ? totalBooked / totalWork : 0,
    bookings: counted,
    staff: staff.map((m) => {
      const own = counted.filter((x) => x.b.staffId === m.id);
      const u = perStaff.get(m.id);
      return { id: m.id, name: m.name, color: m.color, revenue: own.reduce((a, x) => a + x.b.finalPriceCents, 0), utilization: u?.work ? u.booked / u.work : 0 };
    }),
  };
}
