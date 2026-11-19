import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CalendarCheck } from "lucide-react";
import { db, schema as s } from "@/db";
import { needsActivation, readSession } from "@/lib/session";
import { billingEnabled, syncSubscriptionCheckout } from "@/server/billing";
import { logout } from "@/app/(auth)/actions";
import { ActivateForm } from "./ActivateForm";

export const metadata: Metadata = { title: "Aktiveeri pakett" };

async function Content({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const session = await readSession();
  if (!session) redirect("/logi-sisse");
  // naasmine makselehelt: kontrolli kohe (webhook võib hilineda)
  if (sp.tellimus === "ok" && typeof sp.s === "string" && /^cs_\w+$/.test(sp.s) && billingEnabled()) {
    await syncSubscriptionCheckout(sp.s, session.business.id).catch(() => false);
    const b = await db.query.businesses.findFirst({ where: eq(s.businesses.id, session.business.id) });
    if (b && !needsActivation({ user: session.user, business: b })) redirect("/toolaud?tere=1");
  }
  if (!needsActivation(session)) redirect("/toolaud");
  const b = session.business;
  return (
    <>
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.3px]">{b.planStatus === "SUSPENDED" ? "Tellimus on lõppenud" : "Aktiveeri pakett"}</h1>
        <p className="mt-1 text-sm text-muted">
          {sp.tellimus === "katkestatud"
            ? "Makse jäi pooleli. Vali pakett ja proovi uuesti."
            : b.planStatus === "SUSPENDED"
              ? `${b.name} tellimus on lõppenud. Jätkamiseks vali pakett – kõik andmed on alles.`
              : `Tere tulemast! ${b.name} konto on loodud. Halduspaneel avaneb pärast esimest makset.`}
        </p>
      </div>
      <ActivateForm plan={b.plan} period={b.billingPeriod} isOwner={session.user.role === "OWNER"} />
    </>
  );
}

export default function ActivatePage(props: PageProps<"/aktiveeri">) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[440px] space-y-5 rounded-[16px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-[34px] place-items-center rounded-[9px] bg-lime">
              <CalendarCheck size={18} className="text-ink" />
            </span>
            <span className="text-[17px] font-bold">Aegly</span>
          </div>
          <form action={logout}>
            <button type="submit" className="text-[13px] font-medium text-muted hover:text-ink">
              Logi välja
            </button>
          </form>
        </div>
        <Suspense fallback={<div className="h-[420px] animate-pulse rounded-[12px] bg-line-soft" />}>
          <Content searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
