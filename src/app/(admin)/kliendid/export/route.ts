import { readSession } from "@/lib/session";
import { listClients } from "@/server/clients";
import { centsToInput } from "@/lib/money";
import { formatShortDate, localDate } from "@/lib/time";

/** Kliendibaas CSV-na (semikoolon, UTF-8 BOM – avaneb Excelis õigesti) */
export async function GET() {
  const session = await readSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const tz = session.business.timezone;
  const rows = await listClients(session.business.id);
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    ["Nimi", "E-post", "Telefon", "Külastusi", "Viimane külastus", "Kulutanud (€)", "Ei ilmunud", "Tühistusi"],
    ...rows.map((c) => [
      c.name,
      c.email ?? "",
      c.phone ?? "",
      String(c.visits),
      c.lastVisit ? formatShortDate(localDate(c.lastVisit, tz)) : "",
      centsToInput(c.spentCents),
      String(c.noShows),
      String(c.cancellations),
    ]),
  ];
  return new Response("﻿" + lines.map((l) => l.map(esc).join(";")).join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="kliendid-${session.business.slug}.csv"` },
  });
}
