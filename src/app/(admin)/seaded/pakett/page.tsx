import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireSession } from "@/lib/session";
import { activeStaffCount } from "@/server/plans";
import { PlanPicker } from "./PlanPicker";

export const metadata: Metadata = { title: "Pakett ja arveldus" };

async function Plan() {
  const { business: b, user } = await requireSession();
  return <PlanPicker current={b.plan} period={b.billingPeriod} status={b.planStatus} activeStaff={await activeStaffCount(b.id)} isOwner={user.role === "OWNER"} />;
}

export default function PlanPage() {
  return (
    <div className="max-w-[920px] space-y-5">
      <PageHeader title="Pakett ja arveldus" subtitle="Aegly tellimus, töötajate arv ja hind." />
      <Suspense fallback={<Card className="h-[520px] animate-pulse" />}>
        <Plan />
      </Suspense>
    </div>
  );
}
