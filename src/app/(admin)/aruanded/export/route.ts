import { and, eq, gte, lt } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { readSession } from "@/lib/session";
import { centsToInput } from "@/lib/money";
import { formatShortDate, localDate, localTime, zonedDateTime } from "@/lib/time";
import { BOOKING_STATUS } from "@/lib/booking-status";

/** Perioodi broneeringud CSV-na (raamatupidamisele) */
export async function GET(req: Request) {
  const session = await readSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return new Response("Bad request", { status: 400 });
  const tz = session.business.timezone;
  const rows = await db
    .select({ b: s.bookings, client: s.clients.name, service: s.services.name, staff: s.staffMembers.name })
    .from(s.bookings)
    .innerJoin(s.clients, eq(s.clients.id, s.bookings.clientId))
    .innerJoin(s.services, eq(s.services.id, s.bookings.serviceId))
    .innerJoin(s.staffMembers, eq(s.staffMembers.id, s.bookings.staffId))
    .where(and(eq(s.bookings.businessId, session.business.id), gte(s.bookings.startsAt, zonedDateTime(from, "00:00", tz)), lt(s.bookings.startsAt, zonedDateTime(to, "00:00", tz))))
    .orderBy(s.bookings.startsAt);
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    ["Number", "Kuupäev", "Kell", "Klient", "Teenus", "Töötaja", "Staatus", "Baashind (€)", "Lõpphind (€)", "Allikas"],
    ...rows.map(({ b, client, service, staff }) => [
      b.number, formatShortDate(localDate(b.startsAt, tz)), localTime(b.startsAt, tz), client, service, staff,
      BOOKING_STATUS[b.status].label, centsToInput(b.basePriceCents), centsToInput(b.finalPriceCents), b.source === "WIDGET" ? "Vidin" : "Halduspaneel",
    ]),
  ];
  return new Response("﻿" + lines.map((l) => l.map(esc).join(";")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="broneeringud-${from}-${to}.csv"` },
  });
}
