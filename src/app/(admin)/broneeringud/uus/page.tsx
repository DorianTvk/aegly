import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Uus broneering" };

export default function Page() {
  return <ComingSoon title="Uus broneering" figma="16 Uus broneering" />;
}
