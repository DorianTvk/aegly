import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Broneering" };

export default function Page() {
  return <ComingSoon title="Broneering" figma="02 Kalender → broneeringu detailvaade" />;
}
