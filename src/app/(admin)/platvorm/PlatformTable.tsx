"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Trash2, X } from "lucide-react";
import { BusinessRow, type PlatformRow } from "./BusinessRow";
import { Flash } from "@/components/ui/Flash";
import { deleteBusinesses } from "./manage-actions";

const CONFIRM_WORD = "KUSTUTA";

export function PlatformTable({ rows }: { rows: PlatformRow[] }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => [r.name, r.slug, r.owner].some((v) => v.toLowerCase().includes(t))) : rows;
  }, [rows, q]);
  const selectable = filtered.filter((r) => !r.protected);
  const allChecked = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const chosen = rows.filter((r) => selected.has(r.id));

  const toggle = (id: string, v: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="space-y-3">
      {msg && (
        <Flash ok={msg.ok} token={msg}>
          {msg.text}
        </Flash>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-[260px] flex-1 items-center gap-2 rounded-[10px] border border-line bg-white px-3 sm:max-w-[360px]">
          <Search size={16} className="text-muted" aria-hidden />
          <span className="sr-only">Otsi kliente</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Otsi nime, lühinime või e-posti järgi" className="h-full flex-1 bg-transparent text-sm outline-none" />
        </label>
        <span className="text-sm text-muted">
          {filtered.length} klienti{selected.size > 0 && ` · ${selected.size} valitud`}
        </span>
        {selected.size > 0 && (
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setSelected(new Set())} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-white px-3 text-sm font-semibold">
              <X size={15} aria-hidden /> Tühista valik
            </button>
            <button type="button" onClick={() => { setConfirm(""); setDialog(true); }} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#d92d20] px-4 text-sm font-semibold text-white">
              <Trash2 size={16} aria-hidden /> Kustuta valitud ({selected.size})
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-[#f9fafb] text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
            <tr>
              <th className="w-10 py-3 pl-5">
                <input
                  type="checkbox"
                  checked={allChecked}
                  disabled={selectable.length === 0}
                  onChange={(e) => setSelected(e.target.checked ? new Set([...selected, ...selectable.map((r) => r.id)]) : new Set([...selected].filter((id) => !selectable.some((r) => r.id === id))))}
                  aria-label="Vali kõik nähtavad kliendid"
                  className="size-4 accent-[#d92d20]"
                />
              </th>
              <th className="py-3">Klient</th>
              <th className="py-3">Pakett</th>
              <th className="py-3">Staatus</th>
              <th className="py-3">Kuutulu</th>
              <th className="py-3">Töötajad</th>
              <th className="py-3">Broneeringuid 30 p</th>
              <th className="py-3">Viimane broneering</th>
              <th className="py-3 pr-5">Liitus</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <BusinessRow key={b.id} b={b} selected={selected.has(b.id)} onSelect={(v) => toggle(b.id, v)} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-muted">
                  Ühtegi klienti ei leitud.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => !pending && setDialog(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="bulk-title" className="w-full max-w-[480px] rounded-[16px] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="bulk-title" className="text-[18px] font-bold">
              Kustutada {chosen.length} klienti?
            </h2>
            <p className="mt-1 text-sm text-muted">Kustutatakse kliendikontod koos kõigi töötajate, klientide, broneeringute ja kasutajatega. Seda ei saa tagasi võtta.</p>
            <ul className="mt-3 max-h-[160px] overflow-y-auto rounded-[10px] border border-line-soft px-3 py-2 text-sm">
              {chosen.map((r) => (
                <li key={r.id} className="py-0.5">
                  {r.name} <span className="text-muted">· {r.owner}</span>
                </li>
              ))}
            </ul>
            <label htmlFor="bulk-confirm" className="mt-4 block text-sm font-medium">
              Kinnitamiseks kirjuta <code className="font-mono">{CONFIRM_WORD}</code>
            </label>
            <input id="bulk-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoFocus className="mt-1.5 h-10 w-full rounded-[10px] border border-line px-3 text-sm" />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setDialog(false)} className="h-10 rounded-[10px] border border-line px-4 text-sm font-semibold">
                Loobu
              </button>
              <button
                type="button"
                disabled={confirm.trim() !== CONFIRM_WORD || pending}
                onClick={() =>
                  start(async () => {
                    const r = await deleteBusinesses([...selected], confirm);
                    setMsg({ ok: r.ok, text: r.message });
                    if (r.ok) {
                      setSelected(new Set());
                      setDialog(false);
                    }
                  })
                }
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[#d92d20] px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                <Trash2 size={16} aria-hidden /> {pending ? "Kustutan…" : `Kustuta ${chosen.length}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
