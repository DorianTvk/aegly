import { RoleGate } from "@/components/admin/RoleGate";

export default function Layout({ children }: LayoutProps<"/teavitused">) {
  return <RoleGate allow={["OWNER", "ADMIN"]}>{children}</RoleGate>;
}
