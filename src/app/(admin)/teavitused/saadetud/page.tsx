import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { Mail, MessageSquare } from "lucide-react";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { NOTIFICATIONS } from "@/lib/notifications";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { emailConfigured, smsConfigured } from "@/server/messaging";

export const metadata: Metadata = { title: "Saadetud teavitused" };

const KIND: Record<string, string> = {
  ...Object.fromEntries(NOTIFICATIONS.map((n) => [n.type, n.title])),
  SALON_NEW: "Endale: uus broneering",
  SALON_CHANGED: "Endale: aeg muutus",
  SALON_CANCELLED: "Endale: tühistamine",
  ACCOUNT_VERIFY: "Konto: e-posti kinnitamine",
  ACCOUNT_RESET: "Konto: parooli taastamine",
  ACCOUNT_INVITE: "Konto: kutse",
};
const STATUS = {
  SENT: { label: "Saadetud", tone: "ok" },
  QUEUED: { label: "Ootel", tone: "neutral" },
  FAILED: { label: "Ebaõnnestus", tone: "bad" },
  SKIPPED: { label: "Vahele jäetud", tone: "warn" },
} as const;

async function Log() {
  const b = await getCurrentBusiness();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [rows, [month]] = await Promise.all([
    db.query.outboundMessages.findMany({ where: eq(s.outboundMessages.businessId, b.id), orderBy: [desc(s.outboundMessages.createdAt)], limit: 100 }),
    db
      .select({
        emails: sql<number>`count(*) filter (where ${s.outboundMessages.channel} = 'EMAIL' and ${s.outboundMessages.status} = 'SENT')`,
        sms: sql<number>`coalesce(sum(${s.outboundMessages.segments}) filter (where ${s.outboundMessages.channel} = 'SMS' and ${s.outboundMessages.status} = 'SENT'), 0)`,
      })
      .from(s.outboundMessages)
      .where(and(eq(s.outboundMessages.businessId, b.id), gte(s.outboundMessages.createdAt, monthStart))),
  ]);
  const devMode = !emailConfigured();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[13px] text-muted">E-kirju sel kuul</p>
          <p className="mt-2 text-[24px] font-bold">{Number(month?.emails ?? 0)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] text-muted">SMS-e sel kuul (osi)</p>
          <p className="mt-2 text-[24px] font-bold">{Number(month?.sms ?? 0)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] text-muted">Saatmine</p>
          <p className="mt-2 text-sm">
            E-post: <b>{devMode ? "arendusrežiim" : "Resend"}</b>
            <br />
            SMS: <b>{smsConfigured() ? "Messente" : "pole ühendatud"}</b>
          </p>
        </Card>
      </div>
      {devMode && (
        <p className="rounded-[10px] border border-warn/30 bg-warn-bg px-4 py-3 text-[13px] text-warn">
          Arendusrežiim: kirju klientidele ei saadeta, need salvestatakse ainult siia. Ava rida, et näha kirja sisu.
        </p>
      )}
      <Card>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted">Teavitusi pole veel saadetud. Tee vidinas testbroneering ja kinnitus ilmub siia.</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((m) => {
              const st = m.provider === "dev-log" && m.status === "SENT" ? { label: "Ainult logis", tone: "neutral" as const } : STATUS[m.status];
              return (
                <li key={m.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3.5 hover:bg-[#f9fafb]">
                      {m.channel === "EMAIL" ? <Mail size={17} className="shrink-0 text-muted" aria-label="E-post" /> : <MessageSquare size={17} className="shrink-0 text-muted" aria-label="SMS" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{m.subject ?? m.body.slice(0, 80)}</span>
                        <span className="block truncate text-xs text-muted">
                          {KIND[m.kind] ?? m.kind} · {m.to}
                        </span>
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <span className="hidden w-[120px] text-right text-xs text-muted sm:block">
                        {m.createdAt.toLocaleString("et-EE", { timeZone: b.timezone, day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </summary>
                    <div className="space-y-2 border-t border-line-soft bg-[#f9fafb] px-5 py-4 pl-12 text-sm">
                      {m.error && <p className="text-bad">Põhjus: {m.error}</p>}
                      <pre className="font-sans whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</pre>
                      {m.bookingId && (
                        <Link href={`/broneeringud/${m.bookingId}`} className="inline-block text-[13px] font-semibold underline-offset-4 hover:underline">
                          Ava broneering
                        </Link>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function SentPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Saadetud teavitused" subtitle="Viimased 100 kirja ja SMS-i klientidele ja endale." />
      <Suspense fallback={<Card className="h-[420px] animate-pulse" />}>
        <Log />
      </Suspense>
    </div>
  );
}
