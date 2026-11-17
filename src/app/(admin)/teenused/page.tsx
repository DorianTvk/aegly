import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Teenused" };

export default function Page() {
  return <ComingSoon title="Teenused" figma="03 Teenused" />;
}
