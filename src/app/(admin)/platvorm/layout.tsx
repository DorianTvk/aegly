import { Suspense } from "react";
import { notFound } from "next/navigation";
import { readSession } from "@/lib/session";
import { isSuperadmin } from "@/lib/plans";

/** Kogu /platvorm on nähtav ainult platvormi halduritele (SUPERADMIN_EMAILS); teistele 404 */
async function Guard({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || !isSuperadmin(session.user.email)) notFound();
  return <>{children}</>;
}

export default function PlatformLayout({ children }: LayoutProps<"/platvorm">) {
  return (
    <Suspense fallback={null}>
      <Guard>{children}</Guard>
    </Suspense>
  );
}
