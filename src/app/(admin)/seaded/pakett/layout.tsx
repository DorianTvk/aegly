import { RoleGate } from "@/components/admin/RoleGate";

export default function Layout({ children }: LayoutProps<"/seaded/pakett">) {
  return <RoleGate allow={["OWNER"]}>{children}</RoleGate>;
}
