import Link from "next/link";
import { CalendarDays, Headset, Settings2, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { Card } from "@/components/ui/primitives";
import { AUDIT_CATEGORIES, categoryOf, targetHref, type AuditCategory, type listAudit } from "@/server/audit-query";

const ICON: Record<AuditCategory, LucideIcon> = {
  koik: Settings2,
  broneeringud: CalendarDays,
  kliendid: UserRound,
  seaded: Settings2,
  turvalisus: ShieldCheck,
  tugi: Headset,
};

type Data = Awaited<ReturnType<typeof listAudit>>;

/** Tegevuste logi: filtrid, päevade kaupa grupeeritud kirjed, "Näita vanemaid" */
export function AuditList({ data, category, basePath, timezone, showBusiness = false }: { data: Data; category: AuditCategory; basePath: string; timezone: string; showBusiness?: boolean }) {
  const dayFmt = new Intl.DateTimeFormat("et-EE", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("et-EE", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  const groups = new Map<string, Data["rows"]>();
  for (const r of data.rows) {
    const k = dayFmt.format(r.createdAt);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const href = (c: AuditCategory, before?: string) => {
    const q = new URLSearchParams();
    if (c !== "koik") q.set("tyyp", c);
    if (before) q.set("enne", before);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Filtreeri">
        {(Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map((c) => (
          <Link
            key={c}
            href={href(c)}
            aria-current={c === category ? "page" : undefined}
            className={clsx(
              "inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium",
              c === category ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:bg-line-soft",
            )}
          >
            {AUDIT_CATEGORIES[c].label}
          </Link>
        ))}
      </nav>

      {data.rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted">Siin pole veel ühtegi tegevust.</Card>
      ) : (
        [...groups.entries()].map(([day, rows]) => (
          <Card key={day} className="overflow-hidden">
            <h2 className="border-b border-line bg-line-soft/60 px-5 py-2.5 text-[13px] font-semibold text-ink-2 first-letter:uppercase">{day}</h2>
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const Icon = ICON[categoryOf(r.action)];
                const link = showBusiness ? null : targetHref(r);
                const support = !!r.viaAdmin || r.action.startsWith("support.");
                return (
                  <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                    <span className={clsx("mt-0.5 grid size-8 shrink-0 place-items-center rounded-full", support ? "bg-amber-50 text-amber-700" : "bg-line-soft text-muted")}>
                      <Icon size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <b className="font-semibold">{r.actorName}</b> <span className="text-ink-2">{r.summary.charAt(0).toLowerCase() + r.summary.slice(1)}</span>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <time dateTime={r.createdAt.toISOString()}>{timeFmt.format(r.createdAt)}</time>
                        {showBusiness && <span>· {r.businessName ?? (r.businessId ? "kustutatud ettevõte" : "platvorm")}</span>}
                        {r.actorEmail && <span>· {r.actorEmail}</span>}
                        {r.viaAdmin && <span className="rounded bg-amber-50 px-1.5 py-px font-medium text-amber-800">Aegly tugi kliendi vaates ({r.viaAdmin})</span>}
                      </p>
                    </div>
                    {link && (
                      <Link href={link} className="shrink-0 text-[13px] font-semibold text-ink underline-offset-4 hover:underline">
                        Ava
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}

      {data.nextBefore && (
        <div className="text-center">
          <Link href={href(category, data.nextBefore)} className="inline-flex h-9 items-center rounded-[10px] border border-line bg-white px-4 text-sm font-semibold hover:bg-line-soft">
            Näita vanemaid
          </Link>
        </div>
      )}
    </div>
  );
}
