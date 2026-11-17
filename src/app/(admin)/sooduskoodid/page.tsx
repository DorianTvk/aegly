import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Sooduskoodid" };

export default function Page() {
  return <ComingSoon title="Sooduskoodid" figma="10 Sooduskoodid" />;
}
