"use client";

import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Pencil, Search } from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/primitives";
import { formatEuro } from "@/lib/time";
import { toggleOnline } from "./actions";

export type ServiceRow = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  durationMinutes: number;
  priceType: "FIXED" | "FROM" | "FREE" | "HIDDEN";
  priceCents: number;
  bookableOnline: boolean;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  staff: { id: string; name: string; color: string }[];
};

export function formatServicePrice(type: ServiceRow["priceType"], cents: number) {
  if (type === "FREE") return "Tasuta";
  if (type === "HIDDEN") return "Peidetud";
  const p = formatEuro(cents, { decimals: true });
  return type === "FROM" ? `alates ${p}` : p;
}

function OnlineSwitch({ id, value }: { id: string; value: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimistic}
      aria-label="Online broneeritav"
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleOnline(id, !optimistic);
        })
      }
      className={clsx("relative h-6 w-11 rounded-full transition-colors", optimistic ? "bg-lime" : "bg-[#d0d5dd]")}
    >
      <span className={clsx("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", optimistic && "translate-x-5")} />
    </button>
  );
}

export function ServicesTable({ services, categories }: { services: ServiceRow[]; categories: { id: string; name: string }[] }) {
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const visible = useMemo(
    () =>
      services.filter(
        (sv) => (!cat || sv.categoryId === cat) && (!q || sv.name.toLowerCase().includes(q.toLowerCase().trim())),
      ),
    [services, cat, q],
  );

  const chip = (id: string | null, label: string, count: number) => (
    <button
      key={id ?? "all"}
      type="button"
      onClick={() => setCat(id)}
      aria-pressed={cat === id}
      className={clsx(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
        cat === id ? "border-lime bg-lime-soft text-ink" : "border-line bg-white text-ink hover:bg-[#f9fafb]",
      )}
    >
      {label} <span className="text-muted">{count}</span>
    </button>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {chip(null, "Kõik", services.length)}
          {categories.map((c) => chip(c.id, c.name, services.filter((sv) => sv.categoryId === c.id).length))}
        </div>
        <label className="relative w-[240px]">
          <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Otsi teenust…"
            className="h-10 w-full rounded-[10px] border border-line bg-white pr-3 pl-9 text-sm outline-none focus:border-lime focus:ring-3 focus:ring-lime/30"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#f9fafb] text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
            <tr>
              <th className="py-3 pl-5 font-semibold">Teenus</th>
              <th className="py-3 font-semibold">Kategooria</th>
              <th className="py-3 font-semibold">Kestus</th>
              <th className="py-3 font-semibold">Hind</th>
              <th className="py-3 font-semibold">Töötajad</th>
              <th className="py-3 font-semibold">Online</th>
              <th className="py-3 font-semibold">Staatus</th>
              <th className="py-3 pr-5" />
            </tr>
          </thead>
          <tbody>
            {visible.map((sv) => (
              <tr key={sv.id} className="border-t border-line-soft hover:bg-[#fcfcfd]">
                <td className="py-3.5 pl-5">
                  <div className="flex items-center gap-3">
                    <Link href={`/teenused/${sv.id}`} className="font-medium text-ink hover:underline">
                      {sv.name}
                    </Link>
                  </div>
                </td>
                <td className="py-3.5 text-muted">{sv.categoryName ?? "—"}</td>
                <td className="py-3.5">{sv.durationMinutes} min</td>
                <td className="py-3.5 font-medium">{formatServicePrice(sv.priceType, sv.priceCents)}</td>
                <td className="py-3.5">
                  <div className="flex -space-x-1">
                    {sv.staff.map((m) => (
                      <span key={m.id} title={m.name} className="rounded-full ring-2 ring-white">
                        <Avatar name={m.name} color={m.color} />
                      </span>
                    ))}
                    {sv.staff.length === 0 && <span className="text-xs text-bad">Pole määratud</span>}
                  </div>
                </td>
                <td className="py-3.5">
                  <OnlineSwitch id={sv.id} value={sv.bookableOnline} />
                </td>
                <td className="py-3.5">
                  {sv.status === "DRAFT" ? (
                    <Badge tone="neutral">Mustand</Badge>
                  ) : sv.bookableOnline ? (
                    <Badge tone="ok">Aktiivne</Badge>
                  ) : (
                    <Badge tone="neutral">Ainult admin</Badge>
                  )}
                </td>
                <td className="py-3.5 pr-5 text-right">
                  <Link href={`/teenused/${sv.id}`} aria-label={`Muuda: ${sv.name}`} className="inline-grid size-8 place-items-center rounded-lg text-muted hover:bg-line-soft hover:text-ink">
                    <Pencil size={16} />
                  </Link>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted">
                  {services.length === 0 ? "Teenuseid pole veel lisatud." : "Otsingule vastavaid teenuseid pole."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
