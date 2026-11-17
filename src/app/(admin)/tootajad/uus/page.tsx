import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { ProfileForm } from "../ProfileForm";

export const metadata: Metadata = { title: "Lisa töötaja" };

export default function NewStaffPage() {
  return (
    <div className="max-w-[820px] space-y-5">
      <PageHeader title="Lisa töötaja" subtitle="Pärast lisamist saad määrata tööaja ja teenused." />
      <ProfileForm
        staffId={null}
        values={{ name: "", title: null, email: null, phone: null, color: "#7a5af8", bio: null, bookableOnline: true, active: true }}
      />
    </div>
  );
}
