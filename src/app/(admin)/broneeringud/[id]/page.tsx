import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { CalendarDays, Clock, Mail, Phone, User } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { BOOKING_STATUS } from "@/lib/booking-status";
import { formatEuro, formatLongDate, formatShortDate, localDate, localTime } from "@/lib/time";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Card, CardHeader, LinkButton } from "@/components/ui/primitives";
import { BookingActions, BookingNote } from "./BookingActions";

export const metadata: Metadata = { title: "Broneering" };

async function Booking({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { business, user } = await requireSession();
  const tz = business.timezone;
  const b = await db.query.bookings.findFirst({
    where: and(eq(s.bookings.id, id), eq(s.bookings.businessId, business.id)),
    with: { client: true, service: true, staff: true, payments: true },
  });
  // töötaja näeb ainult oma broneeringuid
  if (!b || (user.role === "STAFF" && b.staffId !== user.staffId)) notFound();
  const st = BOOKING_STATUS[b.status];
  const d = localDate(b.startsAt, tz);
  const paid = b.payments.filter((p) => p.status === "SUCCEEDED").reduce((a, p) => a + p.amountCents, 0);

  return (
    <div className="max-w-[980px] space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[26px] font-bold tracking-[-0.4px]">{b.service.name}</h1>
            <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {b.number} · {b.source === "WIDGET" ? "broneeritud vidinas" : "lisatud halduspaneelis"} · {formatShortDate(localDate(b.createdAt, tz))}
          </p>
        </div>
        <LinkButton href={`/kalender?date=${d}`}>
          <CalendarDays size={16} /> Ava kalendris
        </LinkButton>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Aeg ja teenus" />
            <dl className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-2">
              <div className="flex gap-3">
                <CalendarDays size={18} className="mt-0.5 text-muted" />
                <div>
                  <dt className="text-muted">Kuupäev</dt>
                  <dd className="font-medium">{formatLongDate(d)}</dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock size={18} className="mt-0.5 text-muted" />
                <div>
                  <dt className="text-muted">Kellaaeg</dt>
                  <dd className="font-medium">
                    {localTime(b.startsAt, tz)}–{localTime(b.endsAt, tz)} <span className="text-muted">({Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60000)} min{b.bufferMinutes ? ` + ${b.bufferMinutes} min puhver` : ""})</span>
                  </dd>
                </div>
              </div>
              <div className="flex gap-3">
                <Avatar name={b.staff.name} color={b.staff.color} size={22} />
                <div>
                  <dt className="text-muted">Spetsialist</dt>
                  <dd className="font-medium">{b.staff.name}</dd>
                </div>
              </div>
              {b.cancelReason && (
                <div className="sm:col-span-2">
                  <dt className="text-muted">Tühistamise põhjus</dt>
                  <dd className="font-medium text-bad">{b.cancelReason}</dd>
                </div>
              )}
            </dl>
            <div className="border-t border-line-soft p-5">
              <BookingActions id={b.id} status={b.status} isPast={b.startsAt < new Date()} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Märge" />
            <div className="p-5">
              <BookingNote id={b.id} note={b.note} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Klient" action={<LinkButton href={`/kliendid/${b.client.id}`} size="sm">Kliendikaart</LinkButton>} />
            <ul className="space-y-2.5 p-5 text-sm">
              <li className="flex items-center gap-2.5">
                <User size={16} className="text-muted" /> {b.client.name}
              </li>
              {b.client.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone size={16} className="text-muted" />
                  <a href={`tel:${b.client.phone.replace(/\s/g, "")}`} className="hover:underline">{b.client.phone}</a>
                </li>
              )}
              {b.client.email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={16} className="text-muted" />
                  <a href={`mailto:${b.client.email}`} className="hover:underline">{b.client.email}</a>
                </li>
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Hind" />
            <ul className="space-y-1.5 p-5 text-sm">
              {b.priceBreakdown.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-muted">{l.label}</span>
                  <span className="tabular-nums">{i === 0 ? formatEuro(l.amountCents, { decimals: true }) : `${l.amountCents > 0 ? "+" : ""}${formatEuro(l.amountCents, { decimals: true })}`}</span>
                </li>
              ))}
              <li className="flex justify-between border-t border-line-soft pt-2 font-semibold">
                <span>Lõpphind</span>
                <span className="tabular-nums">{formatEuro(b.finalPriceCents, { decimals: true })}</span>
              </li>
              {b.depositCents > 0 && (
                <li className="flex justify-between text-muted">
                  <span>Ettemaks</span>
                  <span className="tabular-nums">{formatEuro(b.depositCents, { decimals: true })}</span>
                </li>
              )}
              <li className="flex justify-between text-muted">
                <span>Makstud</span>
                <span className="tabular-nums">{formatEuro(paid, { decimals: true })}</span>
              </li>
              <li className="flex justify-between font-medium">
                <span>Tasuda kohapeal</span>
                <span className="tabular-nums">{formatEuro(Math.max(0, b.finalPriceCents - paid), { decimals: true })}</span>
              </li>
            </ul>
          </Card>
          <p className="text-xs text-muted">Kliendi iseteeninduse link (muuda või tühista) lisandub koos broneerimisvidinaga.</p>
        </div>
      </div>
    </div>
  );
}

export default function BookingPage(props: PageProps<"/broneeringud/[id]">) {
  return (
    <Suspense fallback={<Card className="h-[500px] max-w-[980px] animate-pulse" />}>
      <Booking params={props.params} />
    </Suspense>
  );
}
