import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Kliendid" };

export default function Page() {
  return <ComingSoon title="Kliendid" figma="14 Kliendid" />;
}
