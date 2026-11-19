"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Download, Search, UserPlus } from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormMessage, Input, type FormState } from "@/components/ui/form";
import { Switch } from "@/components/ui/pickers";
import { saveClient, type ClientInput } from "./actions";

export type ClientListItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  visits: number;
  lastVisit: string | null; // "16.10.2026"
  nextVisit: string | null; // "03.11"
  spent: string;
  balance: string | null;
  tags: { label: string; tone: "lime" | "warn" | "bad" | "info" | "neutral" }[];
  isNew: boolean;
  isRegular: boolean;
  hasBalance: boolean;
  noShow90: boolean;
  birthdayThisMonth: boolean;
};

type Filter = "all" | "regular" | "new" | "balance" | "noshow" | "birthday";
const TONE = {
  lime: "bg-lime-soft text-ink",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
  info: "bg-[#eff8ff] text-[#175cd3]",
  neutral: "bg-line-soft text-muted",
};

const EMPTY: ClientInput = { name: "", email: "", phone: "", birthday: "", consentSms: true, consentMarketing: false };

export function ClientsView({ clients, monthName }: { clients: ClientListItem[]; monthName: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState<ClientInput | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  const filters: { key: Filter; label: string; test: (c: ClientListItem) => boolean }[] = [
    { key: "all", label: "Kõik", test: () => true },
    { key: "regular", label: "Püsikliendid", test: (c) => c.isRegular },
    { key: "new", label: "Uued", test: (c) => c.isNew },
    { key: "balance", label: "Saldoga", test: (c) => c.hasBalance },
    { key: "noshow", label: "Ei ilmunud", test: (c) => c.noShow90 },
    { key: "birthday", label: `Sünnipäev ${monthName}`, test: (c) => c.birthdayThisMonth },
  ];
  const active = filters.find((f) => f.key === filter)!;
  const needle = q.trim().toLowerCase().replace(/\s/g, "");
  const visible = clients.filter(
    (c) =>
      active.test(c) &&
      (!needle || c.name.toLowerCase().includes(needle) || c.email?.toLowerCase().includes(needle) || c.phone?.replace(/\s/g, "").includes(needle)),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={clsx("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium", filter === f.key ? "border-lime bg-lime-soft" : "border-line bg-white hover:bg-[#f9fafb]")}
            >
              {f.label} <span className="text-muted">{clients.filter(f.test).length}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="relative w-full sm:w-[260px]">
            <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Otsi nime, telefoni või e-posti"
              className="h-10 w-full rounded-[10px] border border-line bg-white pr-3 pl-9 text-sm outline-none focus:border-lime focus:ring-3 focus:ring-lime/30"
            />
          </label>
          <a href="/kliendid/export" download className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-semibold hover:bg-[#f9fafb]">
            <Download size={16} /> Ekspordi
          </a>
          <Button variant="primary" onClick={() => { setState(null); setAdding(EMPTY); }}>
            <UserPlus size={16} /> Lisa klient
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-[#f9fafb] text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
            <tr>
              <th className="py-3 pl-5 font-semibold">Klient</th>
              <th className="py-3 font-semibold">Telefon</th>
              <th className="py-3 font-semibold">Külastusi</th>
              <th className="py-3 font-semibold">Viimane külastus</th>
              <th className="py-3 font-semibold">Kulutanud</th>
              <th className="py-3 font-semibold">Saldo</th>
              <th className="py-3 pr-5 font-semibold">Märge</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr key={c.id} className="cursor-pointer border-t border-line-soft hover:bg-[#fcfcfd]" onClick={() => router.push(`/kliendid/${c.id}`)}>
                <td className="py-3 pl-5">
                  <Link href={`/kliendid/${c.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <Avatar name={c.name} color="#7a5af8" size={32} />
                    <span>
                      <span className="block font-medium">{c.name}</span>
                      <span className="block text-xs text-muted">{c.email ?? "—"}</span>
                    </span>
                  </Link>
                </td>
                <td className="py-3 whitespace-nowrap">{c.phone ?? "—"}</td>
                <td className="py-3 tabular-nums">{c.visits}</td>
                <td className="py-3 whitespace-nowrap">{c.lastVisit ?? (c.nextVisit ? <span className="text-ok">Tulevane {c.nextVisit}</span> : "—")}</td>
                <td className="py-3 tabular-nums">{c.spent}</td>
                <td className="py-3 tabular-nums">{c.balance ?? "—"}</td>
                <td className="py-3 pr-5">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t.label} className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONE[t.tone])}>
                        {t.label}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted">
                  {clients.length === 0 ? "Kliente pole veel. Kliendid lisanduvad broneeringutega automaatselt." : "Otsingule vastavaid kliente pole."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!adding}
        onClose={() => setAdding(null)}
        title="Lisa klient"
        footer={
          <>
            <Button onClick={() => setAdding(null)}>Tühista</Button>
            <Button
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveClient(null, adding!);
                  setState(r);
                  if (r?.ok && r.id) router.push(`/kliendid/${r.id}`);
                })
              }
            >
              Lisa klient
            </Button>
          </>
        }
      >
        {adding && (
          <div className="space-y-4">
            <FormMessage state={state} />
            <Field label="Nimi" htmlFor="cName">
              <Input id="cName" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-post" htmlFor="cEmail">
                <Input id="cEmail" type="email" value={adding.email} onChange={(e) => setAdding({ ...adding, email: e.target.value })} />
              </Field>
              <Field label="Telefon" htmlFor="cPhone">
                <Input id="cPhone" value={adding.phone} placeholder="+372" onChange={(e) => setAdding({ ...adding, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Sünnipäev (valikuline)" htmlFor="cBday">
              <Input id="cBday" type="date" value={adding.birthday} onChange={(e) => setAdding({ ...adding, birthday: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Nõustub SMS-meeldetuletustega</span>
              <Switch checked={adding.consentSms} onChange={(v) => setAdding({ ...adding, consentSms: v })} label="SMS-meeldetuletused" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Nõustub turunduskirjadega</span>
              <Switch checked={adding.consentMarketing} onChange={(v) => setAdding({ ...adding, consentMarketing: v })} label="Turunduskirjad" />
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
