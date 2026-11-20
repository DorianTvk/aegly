import { and, eq, inArray, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { readSession } from "@/lib/session";
import { getClient } from "@/server/clients";
import { logActivity } from "@/server/audit";

/**
 * GDPR: kõik kliendi kohta hoitavad andmed ühe JSON-failina (juurdepääsu- ja andmete ülekandmise õigus).
 * Sisaldab kliendikaarti, broneeringuid, pakette, kinkekaarte, veebioste, ootenimekirja ja saadetud teateid.
 */
export async function GET(_req: Request, ctx: RouteContext<"/kliendid/[id]/export">) {
  const session = await readSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.role === "STAFF") return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const bizId = session.business.id;
  const data = await getClient(bizId, id);
  if (!data) return new Response("Not found", { status: 404 });
  const { client, bookings, packages } = data;
  const email = client.email?.toLowerCase() ?? null;
  const bookingIds = bookings.map((x) => x.b.id);

  const [gifts, orders, waitlist, messages, redemptions] = await Promise.all([
    email
      ? db.query.giftCards.findMany({ where: and(eq(s.giftCards.businessId, bizId), or(sql`lower(${s.giftCards.recipientEmail}) = ${email}`, sql`lower(${s.giftCards.buyerEmail}) = ${email}`)) })
      : Promise.resolve([]),
    email ? db.query.shopOrders.findMany({ where: and(eq(s.shopOrders.businessId, bizId), sql`lower(${s.shopOrders.buyerEmail}) = ${email}`) }) : Promise.resolve([]),
    db.query.waitlistEntries.findMany({ where: and(eq(s.waitlistEntries.businessId, bizId), eq(s.waitlistEntries.clientId, client.id)) }),
    db.query.outboundMessages.findMany({
      where: and(
        eq(s.outboundMessages.businessId, bizId),
        or(
          bookingIds.length ? inArray(s.outboundMessages.bookingId, bookingIds) : undefined,
          email ? sql`lower(${s.outboundMessages.to}) = ${email}` : undefined,
          client.phone ? eq(s.outboundMessages.to, client.phone) : undefined,
        ),
      ),
    }),
    bookingIds.length ? db.query.giftCardRedemptions.findMany({ where: inArray(s.giftCardRedemptions.bookingId, bookingIds) }) : Promise.resolve([]),
  ]);

  const eur = (c: number) => c / 100;
  const body = {
    exportedAt: new Date().toISOString(),
    controller: { name: session.business.name, email: session.business.email, phone: session.business.phone, address: session.business.address },
    client: {
      name: client.name, email: client.email, phone: client.phone, birthday: client.birthday, tags: client.tags,
      consents: { terms: client.consentTermsAt, sms: client.consentSms, marketing: client.consentMarketing },
      notes: client.notes, createdAt: client.createdAt,
    },
    bookings: bookings.map(({ b, service, staff }) => ({
      number: b.number, service, staff, startsAt: b.startsAt, endsAt: b.endsAt, status: b.status, source: b.source,
      priceEur: eur(b.finalPriceCents), depositEur: eur(b.depositCents), giftCardEur: eur(b.giftCardCents),
      priceBreakdown: b.priceBreakdown.map((l) => ({ label: l.label, eur: eur(l.amountCents) })),
      note: b.note, cancelReason: b.cancelReason, cancelledAt: b.cancelledAt, createdAt: b.createdAt,
    })),
    packages: packages.map((p) => ({ name: p.package.name, usesLeft: p.usesLeft, usesTotal: p.usesTotal, purchasedAt: p.purchasedAt, expiresAt: p.expiresAt })),
    giftCards: gifts.map((g) => ({
      code: g.code, role: g.recipientEmail?.toLowerCase() === email ? "saaja" : "ostja", valueEur: eur(g.valueCents), balanceEur: eur(g.balanceCents),
      buyerName: g.buyerName, recipientName: g.recipientName, message: g.message, expiresAt: g.expiresAt, createdAt: g.createdAt,
    })),
    giftCardRedemptions: redemptions.map((r) => ({ amountEur: eur(r.amountCents), note: r.note, at: r.createdAt })),
    onlinePurchases: orders.map((o) => ({ kind: o.kind, status: o.status, amountEur: eur(o.amountCents), name: o.buyerName, phone: o.buyerPhone, createdAt: o.createdAt, paidAt: o.paidAt })),
    waitlist: waitlist.map((w) => ({ date: w.date, createdAt: w.createdAt, notifiedAt: w.notifiedAt })),
    messagesSent: messages.map((m) => ({ channel: m.channel, kind: m.kind, to: m.to, subject: m.subject, body: m.body, status: m.status, at: m.createdAt })),
  };
  await logActivity({ action: "client.exported", summary: `Laadis alla kliendi ${client.name} andmed (GDPR)`, target: { type: "client", id: client.id } });
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="klient-${client.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-${id.slice(0, 6)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
