import type { Metadata } from "next";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { getTargets } from "@/server/targets";
import { Card, PageHeader } from "@/components/ui/primitives";
import { PackagesView } from "./PackagesView";

export const metadata: Metadata = { title: "Paketid" };

async function Packages() {
  const business = await getCurrentBusiness();
  const [{ services }, packages] = await Promise.all([
    getTargets(business.id),
    db.query.packages.findMany({ where: eq(s.packages.businessId, business.id), orderBy: [asc(s.packages.sortOrder), asc(s.packages.createdAt)], with: { items: true, sold: true } }),
  ]);
  return (
    <PackagesView
      services={services.map((x) => ({ id: x.id, name: x.name, durationMinutes: x.durationMinutes, priceCents: x.priceCents }))}
      packages={packages.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        description: p.description,
        priceCents: p.priceCents,
        validityDays: p.validityDays,
        sellInWidget: p.sellInWidget,
        shareable: p.shareable,
        active: p.active,
        items: p.items.map((i) => ({ serviceId: i.serviceId, quantity: i.quantity })),
        sold: p.sold.length,
      }))}
    />
  );
}

export default function PackagesPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Paketid" subtitle="Müü teenuseid kordade paketina või komplektina soodsama hinnaga." />
      <Suspense fallback={<Card className="h-[300px] animate-pulse" />}>
        <Packages />
      </Suspense>
    </div>
  );
}
