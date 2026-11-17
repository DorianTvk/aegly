import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Töötajad" };

export default function Page() {
  return <ComingSoon title="Töötajad" figma="06 Töötajad" />;
}
