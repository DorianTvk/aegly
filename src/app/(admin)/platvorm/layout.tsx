import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import { isSuperadmin } from "@/lib/plans";

/** Kogu /platvorm on nähtav ainult platvormi halduritele (SUPERADMIN_EMAILS); teistele 404 */
async function Guard({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session || !isSuperadmin(session.user.email)) notFound();
  // platvormi halduril on ligipääs kõigi klientide andmetele → kaheastmeline sisselogimine kohustuslik
  // (päris keskkonnas; kohalikus arenduses ja testides saab sisse lülitada REQUIRE_2FA=1)
  const enforce = process.env.VERCEL_ENV === "production" || process.env.REQUIRE_2FA === "1";
  if (enforce && !session.user.totpEnabledAt) redirect("/seaded#turvalisus");
  return <>{children}</>;
}

export default function PlatformLayout({ children }: LayoutProps<"/platvorm">) {
  return (
    <Suspense fallback={null}>
      <Guard>{children}</Guard>
    </Suspense>
  );
}
