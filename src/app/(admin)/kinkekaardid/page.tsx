import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Kinkekaardid" };

export default function Page() {
  return <ComingSoon title="Kinkekaardid" figma="17 Kinkekaardid" />;
}
