import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Kampaaniad" };

export default function Page() {
  return <ComingSoon title="Kampaaniad" figma="11 Kampaaniad" />;
}
