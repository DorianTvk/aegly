import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Hinnakiri" };

export default function Page() {
  return <ComingSoon title="Hinnakiri" figma="09 Hinnakiri" />;
}
