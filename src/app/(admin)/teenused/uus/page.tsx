import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentBusiness } from "@/lib/tenant";
import { ServiceEditor } from "../ServiceEditor";
import { editorProps } from "../editor-data";

export const metadata: Metadata = { title: "Uus teenus" };

async function Editor() {
  const business = await getCurrentBusiness();
  const opts = await editorProps(business.id);
  return (
    <ServiceEditor
      {...opts}
      service={{
        id: null, name: "", categoryId: opts.categories[0]?.id ?? null, description: null, imageUrl: null, translations: {},
        durationMinutes: 60, bufferBeforeMinutes: 0, bufferMinutes: 0,
        priceType: "FIXED", priceCents: 0, vatRate: null, depositPercent: 0,
        bookableOnline: true, showPrice: true, allowStaffChoice: true, maxParticipants: 1,
        minLeadMinutes: null, maxAdvanceDays: null, cancelUntilHours: null, staff: [],
      }}
    />
  );
}

export default function NewServicePage() {
  return (
    <Suspense fallback={<div className="h-[600px] animate-pulse rounded-[14px] bg-white" />}>
      <Editor />
    </Suspense>
  );
}
