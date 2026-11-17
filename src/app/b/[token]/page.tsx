import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { loadManaged } from "@/server/manage";
import { localDate, localTime, todayIso } from "@/lib/time";
import { Manage } from "./Manage";

export const metadata: Metadata = { title: { absolute: "Minu broneering" }, robots: { index: false } };

async function Load({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const m = await loadManaged(token);
  if (!m) notFound();
  const { booking: b, business: biz, tz } = m;
  return (
    <Manage
      token={token}
      today={todayIso(tz)}
      theme={{ primary: biz.widgetPrimary, onPrimary: biz.widgetButtonColor }}
      biz={{ name: biz.name, slug: biz.slug, address: biz.address, phone: biz.phone, logoUrl: biz.widgetShowLogo ? biz.logoUrl : null, maxAdvanceDays: biz.maxAdvanceDays }}
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
      <Load params={props.params} />
    </Suspense>
  );
}
