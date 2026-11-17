import type { Metadata } from "next";
import { Suspense } from "react";
import { Layers, Plus } from "lucide-react";
import { getCurrentBusiness } from "@/lib/tenant";
import { listServices } from "@/server/services";
import { LinkButton, PageHeader } from "@/components/ui/primitives";
import { ServicesTable } from "./ServicesTable";

export const metadata: Metadata = { title: "Teenused" };

async function Services() {
  const business = await getCurrentBusiness();
  const { services, categories } = await listServices(business.id);
  return (
    <ServicesTable
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      services={services.map((sv) => ({
        id: sv.id,
        name: sv.name,
        categoryId: sv.categoryId,
        categoryName: sv.category?.name ?? null,
        durationMinutes: sv.durationMinutes,
        priceType: sv.priceType,
        priceCents: sv.priceCents,
        bookableOnline: sv.bookableOnline,
        status: sv.status,
        staff: sv.staff.map((m) => ({ id: m.id, name: m.name, color: m.color })),
      }))}
    />
  );
}

export default function ServicesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Teenused"
        subtitle="Teenused, mida kliendid saavad vidinas broneerida."
        actions={
          <>
            <LinkButton href="/teenused/kategooriad">
              <Layers size={16} />
              Halda kategooriaid
            </LinkButton>
            <LinkButton href="/teenused/uus" variant="primary">
              <Plus size={16} strokeWidth={2.25} />
              Lisa teenus
            </LinkButton>
          </>
        }
      />
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-[14px] bg-white" />}>
        <Services />
      </Suspense>
    </div>
  );
}
