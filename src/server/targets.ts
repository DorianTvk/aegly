import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { Target } from "@/components/ui/pickers";

/** Valikud sihtimiseks: kategooriad, teenused, töötajad, paketid */
export async function getTargets(businessId: string) {
  const [cats, services, staff, packages] = await Promise.all([
    db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.businessId, businessId), orderBy: [asc(s.serviceCategories.sortOrder)] }),
    db.query.services.findMany({ where: and(eq(s.services.businessId, businessId), sql`${s.services.status} <> 'ARCHIVED'`), orderBy: [asc(s.services.sortOrder)] }),
    db.query.staffMembers.findMany({ where: and(eq(s.staffMembers.businessId, businessId), eq(s.staffMembers.active, true)), orderBy: [asc(s.staffMembers.sortOrder)] }),
    db.query.packages.findMany({ where: eq(s.packages.businessId, businessId), orderBy: [asc(s.packages.sortOrder)] }),
  ]);
  const all: Target[] = [
    ...cats.map((c) => ({ kind: "category" as const, id: c.id, label: c.name })),
    ...services.map((x) => ({ kind: "service" as const, id: x.id, label: x.name })),
    ...staff.map((m) => ({ kind: "staff" as const, id: m.id, label: m.name })),
    ...packages.map((p) => ({ kind: "package" as const, id: p.id, label: p.name })),
  ];
  return { all, cats, services, staff, packages };
}

const WD = ["E", "T", "K", "N", "R", "L", "P"];

export function weekdaysLabel(days: number[]): string | null {
  if (!days.length) return null;
  const sorted = [...days].sort();
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  if (sorted.join() === "6,7") return "Laupäev ja pühapäev";
  if (contiguous && sorted.length > 2) return `${WD[sorted[0] - 1]}–${WD[sorted.at(-1)! - 1]}`;
  return sorted.map((d) => WD[d - 1]).join(", ");
}

/** "Laupäev ja pühapäev · kõik teenused" / "E, K 09–12 · massaažid" */
export function conditionsSummary(
  c: { weekdays: number[]; fromTime: string | null; toTime: string | null; serviceIds: string[]; categoryIds: string[]; staffIds?: string[] },
  names: Map<string, string>,
): string {
  const parts: string[] = [];
  const wd = weekdaysLabel(c.weekdays);
  const time = c.fromTime && c.toTime ? `${c.fromTime.slice(0, 5)}–${c.toTime.slice(0, 5)}` : c.fromTime ? `algus pärast ${c.fromTime}` : null;
  if (wd || time) parts.push([wd, time].filter(Boolean).join(" "));
  const targets = [...c.categoryIds, ...c.serviceIds].map((id) => names.get(id)?.toLowerCase()).filter(Boolean);
  parts.push(targets.length ? targets.join(", ") : "kõik teenused");
  if (c.staffIds?.length) parts.push(c.staffIds.map((id) => names.get(id)).filter(Boolean).join(", "));
  return parts.join(" · ");
}
