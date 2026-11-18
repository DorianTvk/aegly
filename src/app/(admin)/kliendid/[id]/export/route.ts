import { readSession } from "@/lib/session";
import { getClient } from "@/server/clients";

/** GDPR: kõik kliendi andmed ühe JSON-failina (andmete ülekandmise õigus) */
export async function GET(_req: Request, ctx: RouteContext<"/kliendid/[id]/export">) {
  const session = await readSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.role === "STAFF") return new Response("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const data = await getClient(session.business.id, id);
  if (!data) return new Response("Not found", { status: 404 });
  const { client, bookings, packages, gifts } = data;
  const body = {
    exportedAt: new Date().toISOString(),
    business: session.business.name,
    client: {
      name: client.name, email: client.email, phone: client.phone, birthday: client.birthday,
      consents: { terms: client.consentTermsAt, sms: client.consentSms, marketing: client.consentMarketing },
      notes: client.notes, createdAt: client.createdAt,
    },
    bookings: bookings.map(({ b, service, staff }) => ({
      number: b.number, service, staff, startsAt: b.startsAt, endsAt: b.endsAt, status: b.status, priceEur: b.finalPriceCents / 100,
    })),
    packages: packages.map((p) => ({ name: p.package.name, usesLeft: p.usesLeft, usesTotal: p.usesTotal, expiresAt: p.expiresAt })),
    giftCards: gifts.map((g) => ({ code: g.code, balanceEur: g.balanceCents / 100, expiresAt: g.expiresAt })),
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="klient-${id}.json"` },
  });
}
