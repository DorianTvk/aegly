import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadManaged } from "@/server/manage";
import { localDate, localTime, todayIso } from "@/lib/time";
import { Manage } from "./Manage";
import { appUrl } from "@/lib/app-url";
import { canTakeDeposits, stripeConfigured, syncCheckout } from "@/server/stripe";

export const metadata: Metadata = { title: { absolute: "Minu broneering" }, robots: { index: false } };

async function Load({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  // naasmine Stripe'i makselehelt: kontrolli makse kohe (webhook võib hilineda)
  let payment: "paid" | "open" | "expired" | "cancelled" | null = null;
  if (sp.makse === "ok" && typeof sp.s === "string" && /^cs_[\w]+$/.test(sp.s) && stripeConfigured()) {
    payment = await syncCheckout(sp.s, await appUrl()).catch(() => null);
  } else if (sp.makse === "katkestatud") payment = "cancelled";
  const m = await loadManaged(token);
  if (!m) notFound();
  const { booking: b, business: biz, tz } = m;
  return (
    <Manage
      token={token}
      today={todayIso(tz)}
      theme={{ primary: biz.widgetPrimary, onPrimary: biz.widgetButtonColor }}
      biz={{ name: biz.name, slug: biz.slug, address: biz.address, phone: biz.phone, logoUrl: biz.widgetShowLogo ? biz.logoUrl : null, maxAdvanceDays: biz.maxAdvanceDays }}
      payment={payment}
      canPay={b.status === "PENDING_PAYMENT" && b.depositCents > 0 && m.paidCents === 0 && canTakeDeposits(biz)}
      booking={{
        number: b.number,
        status: b.status,
        serviceId: b.serviceId,
        serviceName: b.service.name,
        staffId: b.staffId,
        staffName: b.staff.name,
        date: localDate(b.startsAt, tz),
        start: localTime(b.startsAt, tz),
        end: localTime(b.endsAt, tz),
        finalCents: b.finalPriceCents,
        depositCents: b.depositCents,
        paidCents: m.paidCents,
        deadlineDate: localDate(m.deadline, tz),
        deadlineTime: localTime(m.deadline, tz),
        canChange: m.canChange,
      }}
    />
  );
}

export default function ManagePage(props: PageProps<"/b/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Load params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
