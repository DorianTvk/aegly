import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, LinkButton, PageHeader } from "@/components/ui/primitives";
import { requireSession } from "@/lib/session";
import { staffLimitMessage } from "@/lib/plans";
import { staffUsage } from "@/server/plans";
import { ProfileForm } from "../ProfileForm";

export const metadata: Metadata = { title: "Lisa töötaja" };

async function NewStaff() {
  const { business } = await requireSession();
  const { canAdd } = await staffUsage(business);
  if (!canAdd) {
    return (
      <Card className="p-6">
        <h2 className="text-[15px] font-semibold">Töötajate piir on täis</h2>
        <p className="mt-1.5 text-sm text-muted">{staffLimitMessage(business.plan)}</p>
        <LinkButton href="/seaded/pakett" variant="primary" className="mt-4">
          Vaheta paketti
        </LinkButton>
      </Card>
    );
  }
  return (
    <ProfileForm
      staffId={null}
      values={{ name: "", title: null, email: null, phone: null, color: "#7a5af8", avatarUrl: null, bio: null, bookableOnline: true, active: true }}
    />
  );
}

export default function NewStaffPage() {
  return (
    <div className="max-w-[820px] space-y-5">
      <PageHeader title="Lisa töötaja" subtitle="Pärast lisamist saad määrata tööaja ja teenused." />
      <Suspense fallback={<Card className="h-[420px] animate-pulse" />}>
        <NewStaff />
      </Suspense>
    </div>
  );
}
