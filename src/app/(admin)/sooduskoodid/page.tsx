import type { Metadata } from "next";
import { Suspense } from "react";
import { and, asc, desc, eq, gte, isNotNull, ne } from "drizzle-orm";
import { Euro, Ticket, TrendingUp } from "lucide-react";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { getTargets } from "@/server/targets";
import { formatEuro, formatShortDate, localDate, addDaysIso, todayIso, zonedDateTime } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui/primitives";
import { CodesView, type CodeRow } from "./CodesView";

export const metadata: Metadata = { title: "Sooduskoodid" };

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Ticket }) {
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

async function Codes() {
  const business = await getCurrentBusiness();
  const tz = business.timezone;
  const today = todayIso(tz);
  const monthStart = zonedDateTime(today.slice(0, 8) + "01", "00:00", tz);
  const now = new Date();

  const [{ all }, codes, usedThisMonth] = await Promise.all([
    getTargets(business.id),
    db.query.discountCodes.findMany({ where: eq(s.discountCodes.businessId, business.id), orderBy: [desc(s.discountCodes.active), asc(s.discountCodes.code)] }),
    db
      .select({ breakdown: s.bookings.priceBreakdown })
      .from(s.bookings)
      .where(and(eq(s.bookings.businessId, business.id), isNotNull(s.bookings.discountCodeId), gte(s.bookings.createdAt, monthStart), ne(s.bookings.status, "CANCELLED"))),
  ]);
  const names = new Map(all.map((t) => [t.id, t.label]));
  const discountGiven = usedThisMonth.reduce((sum, b) => sum + b.breakdown.filter((l) => l.kind === "code").reduce((a, l) => a - l.amountCents, 0), 0);

  const rows: CodeRow[] = codes.map((c) => {
    const status: CodeRow["status"] = !c.active
      ? "PAUSED"
      : c.endsAt && c.endsAt < now
        ? "EXPIRED"
        : c.maxUses !== null && c.usedCount >= c.maxUses
          ? "USED_UP"
          : c.startsAt && c.startsAt > now
            ? "SCHEDULED"
            : "ACTIVE";
    const targets = [...c.categoryIds, ...c.serviceIds, ...c.packageIds].map((id) => names.get(id)).filter(Boolean);
    const from = c.startsAt ? localDate(c.startsAt, tz) : null;
    const to = c.endsAt ? addDaysIso(localDate(c.endsAt, tz), -1) : null;
    return {
      id: c.id,
      code: c.code,
      kind: c.kind,
      value: c.value,
      minAmountCents: c.minAmountCents,
      startsOn: from,
      endsOn: to,
      maxUses: c.maxUses,
      maxUsesPerClient: c.maxUsesPerClient,
      newClientsOnly: c.newClientsOnly,
      combinable: c.combinable,
      serviceIds: c.serviceIds,
      categoryIds: c.categoryIds,
      packageIds: c.packageIds,
      active: c.active,
      usedCount: c.usedCount,
      status,
      discountLabel: c.kind === "PERCENT" ? `−${c.value}%` : c.kind === "FIXED" ? `−${formatEuro(c.value, { decimals: true })}` : "Tasuta teenus",
      targetLabel: targets.length ? targets.join(", ") : "Kõik teenused",
      validLabel: from || to ? `${from ? formatShortDate(from) : "…"} – ${to ? formatShortDate(to) : "…"}` : "Tähtajatu",
    };
  });

  const rank = { ACTIVE: 0, SCHEDULED: 1, USED_UP: 2, PAUSED: 3, EXPIRED: 4 };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || a.code.localeCompare(b.code, "et"));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Aktiivsed koodid" value={String(rows.filter((r) => r.status === "ACTIVE").length)} icon={Ticket} />
        <Stat label="Kasutatud sel kuul" value={String(usedThisMonth.length)} icon={TrendingUp} />
        <Stat label="Antud soodustust sel kuul" value={formatEuro(discountGiven, { decimals: false })} icon={Euro} />
      </div>
      <CodesView codes={rows} targets={all.filter((t) => t.kind !== "staff")} />
    </div>
  );
}

export default function CodesPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Sooduskoodid" subtitle="Koodid, mida klient sisestab broneerimisel. Kontrollitakse kehtivust, limiite ja sobivust teenusega." />
      <Suspense fallback={<Card className="h-[400px] animate-pulse" />}>
        <Codes />
      </Suspense>
    </div>
  );
}
