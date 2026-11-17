import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Seaded" };

export default function Page() {
  return <ComingSoon title="Seaded" figma="08 Seaded" />;
}
