import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { readSession } from "@/lib/session";
import { getTargets } from "@/server/targets";
import { centsToInput } from "@/lib/money";

/** Hinnakiri CSV-na (Excelile sobiv: semikoolon, UTF-8 BOM) */
export async function GET() {
  const session = await readSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (session.user.role === "STAFF") return new Response("Forbidden", { status: 403 });
  const { services, staff } = await getTargets(session.business.id);
  const links = await db.select().from(s.staffServices).innerJoin(s.services, eq(s.services.id, s.staffServices.serviceId)).where(eq(s.services.businessId, session.business.id));
  const map = new Map(links.map((l) => [`${l.staff_services.serviceId}:${l.staff_services.staffId}`, l.staff_services.priceCents]));

  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [
    ["Teenus", "Kestus (min)", "Baashind (€)", ...staff.map((m) => m.name)],
    ...services.map((sv) => [
      sv.name,
      String(sv.durationMinutes),
      centsToInput(sv.priceCents),
      ...staff.map((m) => {
        const key = `${sv.id}:${m.id}`;
        if (!map.has(key)) return "";
        return centsToInput(map.get(key) ?? sv.priceCents);
      }),
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(";")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hinnakiri-${session.business.slug}.csv"`,
    },
  });
}
