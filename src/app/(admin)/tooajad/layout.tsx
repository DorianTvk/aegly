import { RoleGate } from "@/components/admin/RoleGate";

export default function Layout({ children }: LayoutProps<"/tooajad">) {
  return <RoleGate allow={["OWNER", "ADMIN"]}>{children}</RoleGate>;
}
