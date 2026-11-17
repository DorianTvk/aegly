import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Broneerimisvidin" };

export default function Page() {
  return <ComingSoon title="Broneerimisvidin" figma="12 Broneerimisvidin" />;
}
