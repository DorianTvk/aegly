import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getCurrentBusiness } from "@/lib/tenant";
import { getServiceForEdit } from "@/server/services";
import { formatShortDate, localDate } from "@/lib/time";
import { ServiceEditor } from "../ServiceEditor";
import { editorProps } from "../editor-data";

export const metadata: Metadata = { title: "Teenus" };

async function Editor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getCurrentBusiness();
  const [data, opts] = await Promise.all([getServiceForEdit(business.id, id), editorProps(business.id)]);
  if (!data) notFound();
  const sv = data.service;
  return (
    <ServiceEditor
      {...opts}
      related={data.related}
      service={{
        id: sv.id,
        name: sv.name,
        categoryId: sv.categoryId,
        description: sv.description,
        imageUrl: sv.imageUrl,
        durationMinutes: sv.durationMinutes,
        bufferBeforeMinutes: sv.bufferBeforeMinutes,
        bufferMinutes: sv.bufferMinutes,
        priceType: sv.priceType,
        priceCents: sv.priceCents,
        vatRate: sv.vatRate,
        depositPercent: sv.depositPercent,
        bookableOnline: sv.bookableOnline,
        showPrice: sv.showPrice,
        allowStaffChoice: sv.allowStaffChoice,
        maxParticipants: sv.maxParticipants,
        minLeadMinutes: sv.minLeadMinutes,
        maxAdvanceDays: sv.maxAdvanceDays,
        cancelUntilHours: sv.cancelUntilHours,
        staff: sv.staff.map((l) => ({ staffId: l.staffId, priceCents: l.priceCents, durationMinutes: l.durationMinutes })),
        subtitle: sv.updatedAt
          ? `Muudetud ${formatShortDate(localDate(sv.updatedAt, business.timezone))}${sv.updatedBy ? ` · ${sv.updatedBy}` : ""}`
          : undefined,
      }}
    />
  );
}

export default function ServicePage(props: PageProps<"/teenused/[id]">) {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[14px] bg-white" />}>
      <Editor params={props.params} />
    </Suspense>
  );
}
