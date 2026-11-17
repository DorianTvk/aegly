import type { Metadata } from "next";
import { Suspense } from "react";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { holidaysBetween } from "@/lib/holidays-ee";
import { addDaysIso, fromMinutes, toMinutes, todayIso } from "@/lib/time";
import { ScheduleSettings } from "./ScheduleSettings";
import { SlotPreview } from "./SlotPreview";
import { HolidaysCard, type HolidayRow } from "./HolidaysCard";

export const metadata: Metadata = { title: "Tööajad ja vabad ajad" };

async function Settings() {
  const business = await getCurrentBusiness();
  const today = todayIso(business.timezone);
  const horizon = addDaysIso(today, 183);

  const [hours, services, staff, own] = await Promise.all([
    db.query.openingHours.findMany({ where: eq(s.openingHours.businessId, business.id) }),
    db.query.services.findMany({ where: eq(s.services.businessId, business.id), orderBy: [asc(s.services.sortOrder)], with: { staff: true } }),
    db.query.staffMembers.findMany({ where: and(eq(s.staffMembers.businessId, business.id), eq(s.staffMembers.active, true)), orderBy: [asc(s.staffMembers.sortOrder)] }),
    db.query.holidays.findMany({ where: and(eq(s.holidays.businessId, business.id), gte(s.holidays.date, today), lte(s.holidays.date, horizon)) }),
  ]);

  const byDay = new Map(hours.map((h) => [h.weekday, h]));
  const hourRows = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const h = byDay.get(weekday);
    return { weekday, open: h ? !h.closed : false, start: h?.startTime ?? "09:00", end: h?.endTime ?? "18:00" };
  });

  // Eesti pühad + ettevõtte erandid; erand on ülimuslik
  const ownDates = new Set(own.map((h) => h.date));
  const rows: HolidayRow[] = [
    ...own.map((h) => ({ id: h.id, date: h.date, name: h.name, closed: h.closed, hours: h.closed ? undefined : `${h.startTime}–${h.endTime}` })),
    ...(business.useNationalHolidays
      ? holidaysBetween(today, horizon)
          .filter((h) => !ownDates.has(h.date))
          .map((h) => {
            if (h.kind === "closed") return { date: h.date, name: h.name, closed: true };
            const open = hourRows[(new Date(h.date + "T12:00:00Z").getUTCDay() + 6) % 7];
            return { date: h.date, name: h.name, closed: !open.open, hours: open.open ? `${open.start}–${fromMinutes(Math.max(toMinutes(open.start), toMinutes(open.end) - 180))}` : undefined };
          })
      : []),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <ScheduleSettings
      initial={{
        hours: hourRows,
        slotStepMinutes: business.slotStepMinutes,
        slotMode: business.slotMode,
        minLeadMinutes: business.minLeadMinutes,
        maxAdvanceDays: business.maxAdvanceDays,
        cancelUntilHours: business.cancelUntilHours,
        autoConfirm: business.autoConfirm,
        useNationalHolidays: business.useNationalHolidays,
      }}
      sideCards={
        <>
          <SlotPreview
            today={today}
            services={services.filter((sv) => sv.status !== "ARCHIVED").map((sv) => ({ id: sv.id, name: sv.name, staffIds: sv.staff.map((l) => l.staffId) }))}
            staff={staff.map((m) => ({ id: m.id, name: m.name }))}
          />
          <HolidaysCard rows={rows} nationalOn={business.useNationalHolidays} today={today} />
        </>
      }
    />
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[14px] bg-white" />}>
      <Settings />
    </Suspense>
  );
}
