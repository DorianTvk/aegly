import "server-only";
import { and, desc, eq, inArray, like, lt, or, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";

export const AUDIT_CATEGORIES = {
  koik: { label: "Kõik", prefixes: [] as string[] },
  broneeringud: { label: "Broneeringud", prefixes: ["booking."] },
  kliendid: { label: "Kliendid", prefixes: ["client."] },
  seaded: {
    label: "Seaded ja meeskond",
    prefixes: ["service.", "staff.", "settings.", "plan.", "user.", "code.", "giftcard.", "campaign.", "package.", "pricing."],
  },
  turvalisus: { label: "Sisselogimised ja turvalisus", prefixes: ["security."] },
  tugi: { label: "Aegly tugi", prefixes: ["support.", "platform."] },
} as const;
export type AuditCategory = keyof typeof AUDIT_CATEGORIES;

export const parseCategory = (v?: string): AuditCategory => (v && v in AUDIT_CATEGORIES ? (v as AuditCategory) : "koik");

export function categoryOf(action: string): AuditCategory {
  for (const [k, c] of Object.entries(AUDIT_CATEGORIES)) if (c.prefixes.some((p) => action.startsWith(p))) return k as AuditCategory;
  return "seaded";
}

/** Link sihtobjektile halduspaneelis */
export function targetHref(t: { targetType: string | null; targetId: string | null }): string | null {
  if (!t.targetId) return null;
  const base = { booking: "/broneeringud", client: "/kliendid", service: "/teenused", staff: "/tootajad" }[t.targetType ?? ""];
  return base ? `${base}/${t.targetId}` : null;
}

const PAGE = 50;

/**
 * Tegevuste logi, uuemad ees. businessId = null → kogu platvorm (ainult platvormi haldur).
 * Lehekülgede kaupa: `before` = eelmise lehe viimase kirje aeg.
 */
export async function listAudit(opts: { businessId: string | null; category: AuditCategory; before?: Date | null }) {
  const cond: (SQL | undefined)[] = [];
  if (opts.businessId) cond.push(eq(s.auditLog.businessId, opts.businessId));
  const prefixes = AUDIT_CATEGORIES[opts.category].prefixes;
  if (prefixes.length) cond.push(or(...prefixes.map((p) => like(s.auditLog.action, `${p}%`))));
  if (opts.before && !Number.isNaN(opts.before.getTime())) cond.push(lt(s.auditLog.createdAt, opts.before));
  const rows = await db
    .select()
    .from(s.auditLog)
    .where(and(...cond))
    .orderBy(desc(s.auditLog.createdAt))
    .limit(PAGE + 1);
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);
  // platvormi vaates ettevõtete nimed
  let names = new Map<string, string>();
  if (!opts.businessId) {
    const ids = [...new Set(page.map((r) => r.businessId).filter((x): x is string => !!x))];
    if (ids.length) {
      const bs = await db.select({ id: s.businesses.id, name: s.businesses.name }).from(s.businesses).where(inArray(s.businesses.id, ids));
      names = new Map(bs.map((b) => [b.id, b.name]));
    }
  }
  return {
    rows: page.map((r) => ({ ...r, businessName: r.businessId ? (names.get(r.businessId) ?? null) : null })),
    nextBefore: more ? page[page.length - 1].createdAt.toISOString() : null,
  };
}

/** Vanad kirjed minema (hoitakse 1 aasta) */
export async function pruneAudit() {
  await db.delete(s.auditLog).where(lt(s.auditLog.createdAt, new Date(Date.now() - 365 * 86_400_000)));
}

