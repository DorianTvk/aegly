import "server-only";
import { and, asc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { scheduleFor, type ScheduleRow } from "@/lib/schedule";
import { addDaysIso, isoWeekday, todayIso, zonedDateTime } from "@/lib/time";

export const WEEKDAY_SHORT = ["E", "T", "K", "N", "R", "L", "P"];

/** Kehtivad graafikuread kuupäeva seisuga, nädalapäeva järgi */
export function currentWeek(rows: ScheduleRow[], isoDate: string): (ScheduleRow | undefined)[] {
  // võtame selle nädala esmaspäeva, et leida iga päeva kehtiv rida
  const monday = addDaysIso(isoDate, 1 - isoWeekday(isoDate));
  return [0, 1, 2, 3, 4, 5, 6].map((i) => scheduleFor(rows, addDaysIso(monday, i)));
}

/** "E–R 09–18" / "T, K, N 10–19" */
export function scheduleSummary(week: (ScheduleRow | undefined)[]): string {
  const on = week.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
  if (!on.length) return "—";
  const hhmm = (t: string) => (t.endsWith(":00") ? t.slice(0, 2) : t);
  const hours = new Set(on.map((i) => `${hhmm(week[i]!.startTime)}–${hhmm(week[i]!.endTime)}`));
  const contiguous = on.every((d, k) => k === 0 || d === on[k - 1] + 1);
  const days = contiguous && on.length > 2 ? `${WEEKDAY_SHORT[on[0]]}–${WEEKDAY_SHORT[on.at(-1)!]}` : on.map((i) => WEEKDAY_SHORT[i]).join(", ");
  return hours.size === 1 ? `${days} ${[...hours][0]}` : `${days} · erinevad ajad`;
}

export async function listStaff(businessId: string, tz: string) {
  const today = todayIso(tz);
  const now = new Date();
  const staff = await db.query.staffMembers.findMany({
    where: eq(s.staffMembers.businessId, businessId),
    orderBy: [asc(s.staffMembers.sortOrder), asc(s.staffMembers.name)],
    with: {
      schedules: true,
      services: true,
      timeOff: { where: and(lte(s.timeOff.startsAt, zonedDateTime(addDaysIso(today, 1), "00:00", tz)), gte(s.timeOff.endsAt, now)) },
    },
  });
  const users = await db.query.users.findMany({ where: eq(s.users.businessId, businessId) });
  const userById = new Map(users.map((u) => [u.id, u]));

  return staff.map((m) => {
    const week = currentWeek(m.schedules, today);
    const onLeave = m.timeOff.some((t) => t.startsAt <= now && t.endsAt > now);
    const status: "ACTIVE" | "LEAVE" | "INVITED" | "INACTIVE" = !m.active
      ? "INACTIVE"
      : onLeave
        ? "LEAVE"
        : m.invitedAt && !m.userId
          ? "INVITED"
          : "ACTIVE";
    return {
      id: m.id,
      name: m.name,
      title: m.title,
      email: m.email,
      color: m.color,
      role: m.userId ? (userById.get(m.userId)?.role ?? "STAFF") : "STAFF",
      serviceCount: m.services.length,
      workdays: week.map(Boolean),
      summary: scheduleSummary(week),
      status,
    };
  });
}

export async function getStaffMember(businessId: string, staffId: string) {
  return db.query.staffMembers.findFirst({
    where: and(eq(s.staffMembers.id, staffId), eq(s.staffMembers.businessId, businessId)),
    with: { schedules: true, services: true, timeOff: { orderBy: [asc(s.timeOff.startsAt)] } },
  });
}

/** Tulevased ja käimasolevad puudumised */
export async function upcomingTimeOff(staffId: string) {
  return db.query.timeOff.findMany({
    where: and(eq(s.timeOff.staffId, staffId), or(gte(s.timeOff.endsAt, new Date()), isNull(s.timeOff.endsAt))),
    orderBy: [asc(s.timeOff.startsAt)],
  });
}
