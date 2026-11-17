import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Paketid" };

export default function Page() {
  return <ComingSoon title="Paketid" figma="05 Paketid" />;
}
