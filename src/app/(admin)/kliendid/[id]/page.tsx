import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarPlus, Check, Download, Gift, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { getCurrentBusiness } from "@/lib/tenant";
import { getClient, requiresFullPrepayment } from "@/server/clients";
import { BOOKING_STATUS } from "@/lib/booking-status";
import { formatEuro, formatShortDate, localDate, localTime } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Card, CardHeader, LinkButton } from "@/components/ui/primitives";
import { DeleteClientButton, EditClientButton, NoShowExempt, NotesCard } from "./ClientParts";

export const metadata: Metadata = { title: "Kliendikaart" };

const WD = ["E", "T", "K", "N", "R", "L", "P"];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="mt-1.5 text-[22px] font-bold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </Card>
  );
}

async function ClientCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getCurrentBusiness();
  const tz = business.timezone;
  const data = await getClient(business.id, id);
  if (!data) notFound();
  const { client: c, bookings, packages, gifts } = data;
  const now = new Date();
  const yearAgo = new Date(now.getTime() - 365 * 86_400_000);

  const completed = bookings.filter((x) => x.b.status === "COMPLETED");
  const noShows = bookings.filter((x) => x.b.status === "NO_SHOW");
  const noShows12m = noShows.filter((x) => x.b.startsAt >= yearAgo).length;
  const cancelled = bookings.filter((x) => x.b.status === "CANCELLED");
  const upcoming = bookings.filter((x) => x.b.startsAt >= now && ["CONFIRMED", "PENDING_PAYMENT", "HELD"].includes(x.b.status)).reverse();
  const spent = completed.reduce((a, x) => a + x.b.finalPriceCents, 0);
  const protectedClient = requiresFullPrepayment(noShows12m, business.noShowThreshold, business.noShowProtection, c.noShowExempt);
  const lastNoShow = noShows[0] ? formatShortDate(localDate(noShows[0].b.startsAt, tz)).slice(0, 5) : null;
  const date = (d: Date) => formatShortDate(localDate(d, tz));

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <Avatar name={c.name} color="#7a5af8" size={60} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] font-bold tracking-[-0.3px]">{c.name}</h1>
            {noShows.length > 0 && <Badge tone="bad">Ei ilmunud {noShows.length}×</Badge>}
            {protectedClient && <Badge tone="warn">Ettemaks 100% nõutud</Badge>}
            {c.tags.includes("VIP") && <Badge tone="ok">VIP</Badge>}
          </div>
          <p className="mt-1 text-[13px] text-muted">
            {[c.email, c.phone, `klient alates ${date(c.createdAt)}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <EditClientButton
          id={c.id}
          initial={{ name: c.name, email: c.email ?? "", phone: c.phone ?? "", birthday: c.birthday ?? "", consentSms: c.consentSms, consentMarketing: c.consentMarketing }}
        />
        <LinkButton href={`/broneeringud/uus?client=${c.id}`} variant="primary">
          <CalendarPlus size={16} /> Uus broneering
        </LinkButton>
      </Card>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Külastusi" value={String(completed.length)} />
            <Stat label="Kulutanud" value={formatEuro(spent, { decimals: false })} />
            <Stat label="Ei ilmunud" value={String(noShows.length)} sub={lastNoShow ? `viimati ${lastNoShow}` : undefined} />
            <Stat label="Keskmine arve" value={completed.length ? formatEuro(Math.round(spent / completed.length), { decimals: false }) : "—"} />
          </div>

          <Card>
            <CardHeader title="Tulevased broneeringud" />
            {upcoming.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Tulevasi broneeringuid pole.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {upcoming.map(({ b, service, staff }) => {
                  const d = localDate(b.startsAt, tz);
                  const wd = WD[(new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7];
                  const st = BOOKING_STATUS[b.status];
                  return (
                    <li key={b.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">
                          {wd} {formatShortDate(d)} · {localTime(b.startsAt, tz)}–{localTime(b.endsAt, tz)}
                        </p>
                        <p className="text-[13px] text-muted">
                          {service} · {staff} · {formatEuro(b.finalPriceCents, { decimals: true })}
                        </p>
                      </div>
                      <Badge tone={st.tone}>{st.label}</Badge>
                      <LinkButton href={`/broneeringud/${b.id}`} size="sm">
                        Ava broneering
                      </LinkButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Broneeringute ajalugu"
              subtitle={`${completed.length} külastust · ${noShows.length} mitteilmumist · ${cancelled.length} tühistust`}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
                  <tr>
                    <th className="py-2.5 pl-5 font-semibold">Kuupäev</th>
                    <th className="py-2.5 font-semibold">Teenus</th>
                    <th className="py-2.5 font-semibold">Töötaja</th>
                    <th className="py-2.5 font-semibold">Summa</th>
                    <th className="py-2.5 pr-5 font-semibold">Staatus</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings
                    .filter((x) => x.b.startsAt < now)
                    .slice(0, 30)
                    .map(({ b, service, staff }) => (
                      <tr key={b.id} className="border-t border-line-soft">
                        <td className="py-2.5 pl-5">
                          <Link href={`/broneeringud/${b.id}`} className="hover:underline">
                            {date(b.startsAt)}
                          </Link>
                        </td>
                        <td className="py-2.5">{service}</td>
                        <td className="py-2.5 text-muted">{staff}</td>
                        <td className="py-2.5 tabular-nums">{b.clientPackageId ? "Pakett" : formatEuro(b.finalPriceCents, { decimals: true })}</td>
                        <td className="py-2.5 pr-5">
                          <Badge tone={BOOKING_STATUS[b.status].tone}>{BOOKING_STATUS[b.status].label}</Badge>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {bookings.filter((x) => x.b.startsAt < now).length === 0 && <p className="px-5 py-6 text-sm text-muted">Varasemaid külastusi pole.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Mitteilmumise kaitse"
              action={protectedClient ? <Badge tone="warn">Aktiivne</Badge> : <Badge tone="neutral">Ei rakendu</Badge>}
            />
            <div className="space-y-4 p-5">
              <div className={`flex gap-3 rounded-[10px] p-3 ${protectedClient ? "bg-warn-bg" : "bg-line-soft"}`}>
                {protectedClient ? <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warn" /> : <ShieldCheck size={18} className="mt-0.5 shrink-0 text-muted" />}
                <p className="text-[13px]">
                  {protectedClient
                    ? `${noShows12m} mitteilmumist viimase 12 kuu jooksul. Vidinas nõutakse sellelt kliendilt 100% ettemaksu.`
                    : business.noShowProtection
                      ? `Kaitse rakendub alates ${business.noShowThreshold} mitteilmumisest 12 kuu jooksul (praegu ${noShows12m}).`
                      : "Mitteilmumise kaitse on seadetes välja lülitatud."}
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">Erand: ära nõua ettemaksu</span>
                  <span className="text-xs text-muted">Kehtib ainult sellele kliendile</span>
                </span>
                <NoShowExempt id={c.id} exempt={c.noShowExempt} />
              </div>
              <p className="text-xs text-muted">Reeglit muudad: Seaded → Maksed ja kaitse</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Paketid ja kinkekaardid" />
            <div className="space-y-3 p-5">
              {packages.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{p.package.name}</p>
                    <p className="text-xs text-muted">{p.expiresAt ? `Kehtib kuni ${date(p.expiresAt)}` : "Tähtajatu"}</p>
                  </div>
                  <div className="w-24 text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {p.usesLeft} / {p.usesTotal}
                    </p>
                    <div className="mt-1 h-1.5 rounded bg-line-soft">
                      <div className="h-1.5 rounded bg-lime" style={{ width: `${(p.usesLeft / p.usesTotal) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              {packages.length === 0 && <p className="text-sm text-muted">Pakette pole</p>}
              <div className="border-t border-line-soft pt-3">
                {gifts.length ? (
                  gifts.map((g) => (
                    <p key={g.id} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Gift size={15} /> <span className="font-mono">{g.code}</span>
                      </span>
                      <span className="font-semibold">{formatEuro(g.balanceCents, { decimals: true })}</span>
                    </p>
                  ))
                ) : (
                  <p className="flex items-center gap-2 text-sm text-muted">
                    <Gift size={15} /> Kinkekaarte pole
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Märkmed (${c.notes.length})`} subtitle="Nähtav ainult töötajatele" />
            <NotesCard id={c.id} notes={c.notes.map((n) => ({ text: n.text, author: n.author, when: formatShortDate(n.at.slice(0, 10)) }))} />
          </Card>

          <Card>
            <CardHeader title="Nõusolekud ja andmed" />
            <ul className="space-y-2.5 p-5 text-sm">
              {(
                [
                  ["Broneerimistingimused", c.consentTermsAt ? date(c.consentTermsAt) : null],
                  ["SMS-meeldetuletused", c.consentSms ? "antud" : null],
                  ["Turunduskirjad", c.consentMarketing ? "antud" : null],
                ] as const
              ).map(([label, value]) => (
                <li key={label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    {value ? <Check size={15} className="text-ok" /> : <X size={15} className="text-subtle" />}
                    {label}
                  </span>
                  <span className={value ? "text-muted" : "text-subtle"}>{value ?? "ei ole antud"}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-line-soft px-5 py-3">
              <a href={`/kliendid/${c.id}/export`} className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border border-line px-2.5 text-[13px] font-semibold hover:bg-[#f9fafb]">
                <Download size={15} /> Ekspordi andmed
              </a>
              <DeleteClientButton id={c.id} name={c.name} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ClientPage(props: PageProps<"/kliendid/[id]">) {
  return (
    <Suspense fallback={<Card className="h-[600px] animate-pulse" />}>
      <ClientCard params={props.params} />
    </Suspense>
  );
}
