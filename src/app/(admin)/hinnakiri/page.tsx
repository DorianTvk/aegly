import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { Download } from "lucide-react";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { getTargets, conditionsSummary } from "@/server/targets";
import { formatEuro, formatShortDate } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui/primitives";
import { PriceRules } from "./PriceRules";
import { TaxCard } from "./TaxCard";

export const metadata: Metadata = { title: "Hinnakiri" };

async function PriceList() {
  const business = await getCurrentBusiness();
  const [{ all, services, staff }, links, rules] = await Promise.all([
    getTargets(business.id),
    db
      .select({ staffId: s.staffServices.staffId, serviceId: s.staffServices.serviceId, price: s.staffServices.priceCents })
      .from(s.staffServices)
      .innerJoin(s.services, eq(s.services.id, s.staffServices.serviceId))
      .where(eq(s.services.businessId, business.id)),
    db.query.priceRules.findMany({ where: eq(s.priceRules.businessId, business.id), orderBy: [asc(s.priceRules.sortOrder)] }),
  ]);
  const names = new Map(all.map((t) => [t.id, t.label]));
  const link = new Map(links.map((l) => [`${l.serviceId}:${l.staffId}`, l]));
  const fromPrefix = (t: string) => (t === "FROM" ? "alates " : "");

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[#f9fafb] text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
            <tr>
              <th className="py-3 pl-5 font-semibold">Teenus</th>
              <th className="py-3 font-semibold">Baashind</th>
              {staff.map((m) => (
                <th key={m.id} className="py-3 font-semibold">
                  {m.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {services.map((sv) => (
              <tr key={sv.id} className="border-t border-line-soft">
                <td className="py-3 pl-5">
                  <Link href={`/teenused/${sv.id}`} className="font-medium hover:underline">
                    {sv.name}
                  </Link>
                  <p className="text-xs text-muted">{sv.durationMinutes} min</p>
                </td>
                <td className="py-3 font-semibold">
                  {sv.priceType === "FREE" ? "Tasuta" : `${fromPrefix(sv.priceType)}${formatEuro(sv.priceCents, { decimals: true })}`}
                </td>
                {staff.map((m) => {
                  const l = link.get(`${sv.id}:${m.id}`);
                  if (!l) return <td key={m.id} className="py-3 text-subtle">—</td>;
                  const custom = l.price !== null;
                  return (
                    <td key={m.id} className="py-3">
                      <span className={custom ? "rounded-md bg-lime-soft px-2 py-1 font-semibold" : ""}>{formatEuro(l.price ?? sv.priceCents, { decimals: true })}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <PriceRules
          targets={all.filter((t) => t.kind === "category" || t.kind === "service")}
          rules={rules.map((r) => {
            const extra = [
              r.maxLeadHours !== null ? `broneering vähem kui ${r.maxLeadHours} h enne algust` : null,
              r.minLeadHours !== null ? `vähemalt ${r.minLeadHours} h ette` : null,
              r.dateFrom ? `${formatShortDate(r.dateFrom).slice(0, 5)}–${r.dateTo ? formatShortDate(r.dateTo).slice(0, 5) : "…"}` : null,
            ].filter(Boolean);
            return {
              id: r.id,
              name: r.name,
              kind: r.kind === "FIXED_PRICE" ? "FIXED" : r.kind,
              value: r.value,
              weekdays: r.weekdays,
              fromTime: r.fromTime,
              toTime: r.toTime,
              minLeadHours: r.minLeadHours,
              maxLeadHours: r.maxLeadHours,
              dateFrom: r.dateFrom,
              dateTo: r.dateTo,
              serviceIds: r.serviceIds,
              categoryIds: r.categoryIds,
              active: r.active,
              summary: [...extra, conditionsSummary(r, names)].join(" · "),
            };
          })}
        />
        <TaxCard pricesIncludeVat={business.pricesIncludeVat} vatRate={business.vatRate} />
      </div>
    </div>
  );
}

export default function PriceListPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Hinnakiri"
        subtitle="Teenuste baashinnad ja töötajapõhised erinevused. Esiletõstetud hind erineb baashinnast."
        actions={
          <a href="/hinnakiri/export" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-semibold hover:bg-[#f9fafb]">
            <Download size={16} />
            Ekspordi CSV
          </a>
        }
      />
      <Suspense fallback={<Card className="h-[480px] animate-pulse" />}>
        <PriceList />
      </Suspense>
    </div>
  );
}
