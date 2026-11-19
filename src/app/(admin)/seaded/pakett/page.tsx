import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui/primitives";
import { requireSession } from "@/lib/session";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { activeStaffCount } from "@/server/plans";
import { billingEnabled, syncSubscriptionCheckout } from "@/server/billing";
import { formatShortDate, localDate } from "@/lib/time";
import { PlanPicker } from "./PlanPicker";

export const metadata: Metadata = { title: "Pakett ja arveldus" };

async function Plan({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { business: b, user } = await requireSession();
  let notice: "ok" | "cancelled" | null = null;
  // naasmine Stripe'i makselehelt: uuenda kohe (webhook võib hilineda)
  if (sp.tellimus === "ok" && typeof sp.s === "string" && /^cs_\w+$/.test(sp.s) && billingEnabled()) {
    const ok = await syncSubscriptionCheckout(sp.s, b.id).catch(() => false);
    if (ok) notice = "ok";
  } else if (sp.tellimus === "katkestatud") notice = "cancelled";
  const fresh = notice === "ok" ? ((await db.query.businesses.findFirst({ where: eq(s.businesses.id, b.id) })) ?? b) : b;
  const fmt = (d: Date | null) => (d ? formatShortDate(localDate(d, fresh.timezone)) : null);
  return (
    <PlanPicker
      current={fresh.plan}
      period={fresh.billingPeriod}
      status={fresh.planStatus}
      activeStaff={await activeStaffCount(fresh.id)}
      isOwner={user.role === "OWNER"}
      billing={billingEnabled()}
      hasSubscription={!!fresh.stripeSubscriptionId && (fresh.planStatus === "ACTIVE" || fresh.planStatus === "PAST_DUE")}
      hasCustomer={!!fresh.stripeCustomerId}
      renewsAt={fmt(fresh.planRenewsAt)}
      cancelAt={fmt(fresh.planCancelAt)}
      notice={notice}
    />
  );
}

export default function PlanPage(props: PageProps<"/seaded/pakett">) {
  return (
    <div className="max-w-[920px] space-y-5">
      <PageHeader title="Pakett ja arveldus" subtitle="Aegly tellimus, töötajate arv ja hind." />
      <Suspense fallback={<Card className="h-[520px] animate-pulse" />}>
        <Plan searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
