import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, Pencil, Timer, TrendingUp, UserPlus } from "lucide-react";
import { clsx } from "clsx";
import { getCurrentBusiness } from "@/lib/tenant";
import { listStaff, WEEKDAY_SHORT } from "@/server/staff";
import { loadDay } from "@/server/day";
import { todayIso } from "@/lib/time";
import { totalMinutes } from "@/lib/schedule";
import { ROLE_LABEL } from "@/lib/tenant";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Töötajad" };

const STATUS = {
  ACTIVE: { label: "Aktiivne", tone: "ok" },
  LEAVE: { label: "Puhkusel", tone: "warn" },
  INVITED: { label: "Kutse saadetud", tone: "info" },
  INACTIVE: { label: "Mitteaktiivne", tone: "neutral" },
} as const;

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof TrendingUp }) {
  return (
    <Card className="flex items-start justify-between p-5">
      <div>
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="mt-3 text-[26px] font-bold tracking-[-0.5px]">{value}</p>
      </div>
      <span className="grid size-8 place-items-center rounded-lg bg-lime-soft">
        <Icon size={16} />
      </span>
    </Card>
  );
}

async function StaffList() {
  const business = await getCurrentBusiness();
  const [staff, day] = await Promise.all([listStaff(business.id, business.timezone), loadDay(business.id, todayIso(business.timezone), business.timezone)]);
  const working = day.columns.filter((c) => totalMinutes(c.day.working) > 0);
  const avgUtil = working.length ? Math.round((working.reduce((a, c) => a + c.utilization, 0) / working.length) * 100) : 0;

  const plan = PLANS[business.plan];
  const activeCount = staff.filter((m) => m.status !== "INACTIVE").length;
  const full = plan.staffLimit !== null && activeCount >= plan.staffLimit;

  return (
    <div className="space-y-5">
      <p className={clsx("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border px-4 py-3 text-sm", full ? "border-[#fedf89] bg-[#fffaeb]" : "border-line bg-white")}>
        <span>
          Pakett <b>{plan.name}</b>: {plan.staffLimit === null ? `${activeCount} aktiivset töötajat, piirang puudub` : `${activeCount} / ${plan.staffLimit} aktiivset töötajat`}
        </span>
        {full && <span className="text-muted">Piir on täis.</span>}
        <Link href="/seaded/pakett" className="font-semibold underline-offset-4 hover:underline">
          {full ? "Vaheta paketti" : "Vaata paketti"}
        </Link>
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Aktiivsed töötajad" value={String(staff.filter((m) => m.status === "ACTIVE").length)} icon={TrendingUp} />
        <Stat label="Puhkusel täna" value={String(staff.filter((m) => m.status === "LEAVE").length)} icon={CalendarDays} />
        <Stat label="Keskmine täituvus täna" value={`${avgUtil}%`} icon={Timer} />
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#f9fafb] text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
            <tr>
              <th className="py-3 pl-5 font-semibold">Töötaja</th>
              <th className="py-3 font-semibold">Ametikoht / roll</th>
              <th className="py-3 font-semibold">Teenused</th>
              <th className="py-3 font-semibold">Tööpäevad</th>
              <th className="py-3 font-semibold">Tööaeg</th>
              <th className="py-3 font-semibold">Staatus</th>
              <th className="py-3 pr-5" />
            </tr>
          </thead>
          <tbody>
            {staff.map((m) => (
              <tr key={m.id} className="border-t border-line-soft hover:bg-[#fcfcfd]">
                <td className="py-3 pl-5">
                  <Link href={`/tootajad/${m.id}`} className="flex items-center gap-3">
                    <Avatar name={m.name} color={m.color} size={34} />
                    <span>
                      <span className="block font-medium hover:underline">{m.name}</span>
                      <span className="block text-xs text-muted">{m.email ?? "—"}</span>
                    </span>
                  </Link>
                </td>
                <td className="py-3">
                  <p>{m.title ?? "—"}</p>
                  <p className="text-xs text-muted">{ROLE_LABEL[m.role]}</p>
                </td>
                <td className="py-3">{m.serviceCount} teenust</td>
                <td className="py-3">
                  <div className="flex gap-1">
                    {WEEKDAY_SHORT.map((d, i) => (
                      <span key={d} className={clsx("grid size-[22px] place-items-center rounded text-[10px] font-semibold", m.workdays[i] ? "bg-lime-soft text-ink" : "bg-line-soft text-subtle")}>
                        {d}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 text-muted">{m.summary}</td>
                <td className="py-3">
                  <Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge>
                </td>
                <td className="py-3 pr-5 text-right">
                  <Link href={`/tootajad/${m.id}`} aria-label={`Muuda: ${m.name}`} className="inline-grid size-8 place-items-center rounded-lg text-muted hover:bg-line-soft hover:text-ink">
                    <Pencil size={16} />
                  </Link>
                </td>
              </tr>
            ))}
            {staff.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted">
                  Töötajaid pole veel lisatud.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StaffPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Töötajad"
        subtitle="Töötajad, nende tööajad ja teenused. Vabad ajad arvutatakse nende graafikute põhjal."
        actions={
          <LinkButton href="/tootajad/uus" variant="primary">
            <UserPlus size={16} />
            Lisa töötaja
          </LinkButton>
        }
      />
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-[14px] bg-white" />}>
        <StaffList />
      </Suspense>
    </div>
  );
}
