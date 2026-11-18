import { RoleGate } from "@/components/admin/RoleGate";

export default function Layout({ children }: LayoutProps<"/vidin">) {
  return <RoleGate allow={["OWNER", "ADMIN"]}>{children}</RoleGate>;
}
