import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentBusiness } from "@/lib/tenant";
import { listServices } from "@/server/services";
import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui/primitives";
import { CategoryRow } from "./CategoryForms";

export const metadata: Metadata = { title: "Kategooriad" };

async function Categories() {
  const business = await getCurrentBusiness();
  const { categories, services } = await listServices(business.id);
  return (
    <Card>
      <CardHeader title="Kategooriad" subtitle="Kategooriad grupeerivad teenuseid vidinas ja määravad värvi kalendris." />
      <div className="divide-y divide-line-soft">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} serviceCount={services.filter((s) => s.categoryId === c.id).length} />
        ))}
        <CategoryRow />
      </div>
    </Card>
  );
}

export default function CategoriesPage() {
  return (
    <div className="max-w-[900px] space-y-5">
      <PageHeader title="Halda kategooriaid" actions={<LinkButton href="/teenused">Tagasi teenuste juurde</LinkButton>} />
      <Suspense fallback={<div className="h-[300px] animate-pulse rounded-[14px] bg-white" />}>
        <Categories />
      </Suspense>
    </div>
  );
}
