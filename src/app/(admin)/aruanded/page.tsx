import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Aruanded" };

export default function Page() {
  return <ComingSoon title="Aruanded" figma="18 Aruanded" />;
}
