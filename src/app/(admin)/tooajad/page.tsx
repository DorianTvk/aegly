import type { Metadata } from "next";
import { ComingSoon } from "@/components/admin/ComingSoon";

export const metadata: Metadata = { title: "Tööajad ja vabad ajad" };

export default function Page() {
  return <ComingSoon title="Tööajad ja vabad ajad" figma="08 Tööajad ja vabad ajad" />;
}
