import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Check, Clock, Gift, Package } from "lucide-react";
import { findPublicBusiness } from "@/server/widget";
import { stripeConfigured } from "@/server/stripe";
import { syncShopOrder } from "@/server/shop";
import { appUrl } from "@/lib/app-url";
import { formatEuro } from "@/lib/time";
import { DICT, parseLang } from "../../i18n";

export const metadata: Metadata = { title: { absolute: "Ost" }, robots: { index: false } };

/** Kinkekaardi / paketi makse järel: Stripe suunab siia (?s=CHECKOUT_SESSION_ID) */
async function Result({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const lang = parseLang(sp.lang) ?? "et";
  const t = DICT[lang];
  const b = await findPublicBusiness(slug);
  if (!b) notFound();
  const sessionId = typeof sp.s === "string" ? sp.s : "";
  const r = sessionId && stripeConfigured() ? await syncShopOrder(sessionId, await appUrl()) : null;
  const fmt = (d: Date) => d.toLocaleDateString(lang === "en" ? "en-GB" : lang === "ru" ? "ru-RU" : "et-EE", { timeZone: b.timezone, day: "numeric", month: "long", year: "numeric" });
  const back = `/w/${b.slug}?lang=${lang}`;
  const style = { "--w-primary": b.widgetPrimary, "--w-on-primary": b.widgetButtonColor } as React.CSSProperties;

  let body: React.ReactNode;
  if (!r || r.status !== "paid") {
    body = (
      <>
        <Icon tone="wait"><Clock size={28} /></Icon>
        <p className="mt-4 text-[15px]">{r?.status === "open" ? t.paymentPending : t.paymentExpired}</p>
      </>
    );
  } else if (r.kind === "GIFT_CARD") {
    const other = r.recipientEmail && r.recipientEmail !== r.buyerEmail;
    body = (
      <>
        <Icon><Check size={28} /></Icon>
        <h1 className="mt-3 text-[20px] font-bold">{t.thanks}</h1>
        <div className="mt-5 w-full rounded-[16px] p-5 text-left text-[var(--w-on-primary)]" style={{ background: "var(--w-primary)" }}>
          <p className="flex items-center gap-2 text-[13px] opacity-90"><Gift size={15} aria-hidden /> {t.giftReady} · {b.name}</p>
          <p className="mt-3 text-[28px] font-bold">{formatEuro(r.amountCents)}</p>
          <p className="mt-2 font-mono text-[20px] tracking-wider select-all">{r.code}</p>
          <p className="mt-2 text-[12px] opacity-80">{t.validUntil(fmt(r.expiresAt))}</p>
        </div>
        <p className="mt-4 text-[14px] opacity-70">{other ? `${t.giftSentTo(r.recipientEmail!)} ${t.giftCopyTo(r.buyerEmail)}` : t.giftSentTo(r.buyerEmail)}</p>
      </>
    );
  } else {
    body = (
      <>
        <Icon><Check size={28} /></Icon>
        <h1 className="mt-3 text-[20px] font-bold">{t.thanks}</h1>
        <div className="mt-5 w-full rounded-[16px] border border-black/10 p-5 text-left">
          <p className="flex items-center gap-2 font-semibold"><Package size={16} aria-hidden /> {t.packageReady(r.packageName)}</p>
          <p className="mt-1 text-[14px] opacity-70">
            {t.packageUses(r.uses)}
            {r.expiresAt ? ` · ${t.validUntil(fmt(r.expiresAt))}` : ""}
          </p>
        </div>
        <p className="mt-4 text-[14px] opacity-70">{t.packageHowTo(r.buyerEmail)}</p>
      </>
    );
  }

  return (
    <main lang={lang} style={style} className="flex min-h-dvh justify-center bg-[#f3f4f6] sm:py-8">
      <div className="flex w-full flex-col bg-white px-5 py-8 text-[#1f2937] sm:max-w-[440px] sm:rounded-[20px] sm:shadow-[0_24px_60px_rgba(16,24,40,0.16)]">
        <p className="text-center text-[15px] font-semibold opacity-70">{b.name}</p>
        <div className="mt-6 flex flex-1 flex-col items-center text-center">{body}</div>
        <a href={back} className="mt-8 flex h-12 items-center justify-center rounded-[12px] bg-[var(--w-primary)] text-[15px] font-semibold text-[var(--w-on-primary)]">
          {t.bookNow}
        </a>
      </div>
    </main>
  );
}

function Icon({ children, tone = "ok" }: { children: React.ReactNode; tone?: "ok" | "wait" }) {
  return <span className={tone === "ok" ? "grid size-14 place-items-center rounded-full bg-[#ecfdf3] text-[#067647]" : "grid size-14 place-items-center rounded-full bg-[#fffaeb] text-[#b54708]"}>{children}</span>;
}

export default function ShopResultPage(props: PageProps<"/w/[slug]/ost">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" />}>
      <Result params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
