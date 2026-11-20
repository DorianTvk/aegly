import type { Metadata } from "next";
import { Suspense } from "react";
import { requireManager } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui/primitives";
import { AuditList } from "@/components/admin/audit/AuditList";
import { listAudit, parseCategory } from "@/server/audit-query";

export const metadata: Metadata = { title: "Tegevuste logi" };

async function Log({ searchParams }: { searchParams: Promise<{ tyyp?: string; enne?: string }> }) {
  const { business } = await requireManager();
  const q = await searchParams;
  const category = parseCategory(q.tyyp);
  const data = await listAudit({ businessId: business.id, category, before: q.enne ? new Date(q.enne) : null });
  return <AuditList data={data} category={category} basePath="/seaded/logi" timezone={business.timezone} />;
}

export default function AuditPage(props: PageProps<"/seaded/logi">) {
  return (
    <div className="max-w-[920px] space-y-5">
      <PageHeader title="Tegevuste logi" subtitle="Kes mida ja millal muutis. Kirjeid hoitakse 12 kuud." />
      <Suspense fallback={<Card className="h-[420px] animate-pulse" />}>
        <Log searchParams={props.searchParams as Promise<{ tyyp?: string; enne?: string }>} />
      </Suspense>
    </div>
  );
}
