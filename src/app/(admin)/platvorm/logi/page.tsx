import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { AuditList } from "@/components/admin/audit/AuditList";
import { listAudit, parseCategory } from "@/server/audit-query";

export const metadata: Metadata = { title: "Tegevuste logi · Platvorm" };

async function Log({ searchParams }: { searchParams: Promise<{ tyyp?: string; enne?: string }> }) {
  await connection();
  const q = await searchParams;
  const category = parseCategory(q.tyyp);
  const data = await listAudit({ businessId: null, category, before: q.enne ? new Date(q.enne) : null });
  return <AuditList data={data} category={category} basePath="/platvorm/logi" timezone="Europe/Tallinn" showBusiness />;
}

export default function PlatformAuditPage(props: PageProps<"/platvorm/logi">) {
  return (
    <div className="space-y-5">
      <PageHeader title="Tegevuste logi" subtitle="Kõigi klientide tegevused. Filtri „Aegly tugi“ all on kliendi vaate kasutamine, paketi muutmine ja kustutamine." />
      <Suspense fallback={<Card className="h-[420px] animate-pulse" />}>
        <Log searchParams={props.searchParams as Promise<{ tyyp?: string; enne?: string }>} />
      </Suspense>
    </div>
  );
}
