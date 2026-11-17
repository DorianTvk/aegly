import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Teavitused" };

export default function Page() {
  return <ComingSoon title="Teavitused" figma="19 Teavitused" />;
}
