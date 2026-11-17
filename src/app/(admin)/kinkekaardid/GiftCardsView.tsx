"use client";

import { useState, useTransition } from "react";
import { Gift, Minus, Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormMessage, Input, Select, Textarea, UnitInput, type FormState } from "@/components/ui/form";
import { Switch } from "@/components/ui/pickers";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { formatEuro } from "@/lib/time";
import { redeemGiftCard, saveGiftSettings, sellGiftCard, type GiftSettings, type SellInput } from "./actions";

export type GiftRow = {
  id: string;
  code: string;
  buyer: string;
  recipient: string;
  valueCents: number;
  balanceCents: number;
  expires: string;
  status: "ACTIVE" | "USED" | "EXPIRED" | "EXPIRING";
  daysLeft: number;
};

const STATUS = {
  ACTIVE: { label: "Aktiivne", tone: "ok" },
  USED: { label: "Kasutatud", tone: "neutral" },
  EXPIRED: { label: "Aegunud", tone: "bad" },
  EXPIRING: { label: "Aegub", tone: "warn" },
} as const;

type Tab = "all" | "active" | "used" | "expired";

export function GiftCardsView({ cards, settings, businessName }: { cards: GiftRow[]; settings: GiftSettings; businessName: string }) {
  const [tab, setTab] = useState<Tab>("all");
  const [selling, setSelling] = useState<(SellInput & { valueText: string }) | null>(null);
  const [redeeming, setRedeeming] = useState<{ card: GiftRow; amount: string; note: string } | null>(null);
  const [cfg, setCfg] = useState(settings);
  const [newAmount, setNewAmount] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [cfgState, setCfgState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  const groups: Record<Tab, (c: GiftRow) => boolean> = {
    all: () => true,
    active: (c) => c.status === "ACTIVE" || c.status === "EXPIRING",
    used: (c) => c.status === "USED",
    expired: (c) => c.status === "EXPIRED",
  };
  const visible = cards.filter(groups[tab]);
  const saveCfg = (next: GiftSettings) => {
    setCfg(next);
    start(async () => setCfgState(await saveGiftSettings(next)));
  };

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-line">
          <nav className="flex gap-1">
            {([
              ["all", "Kõik"],
              ["active", "Aktiivsed"],
              ["used", "Kasutatud"],
              ["expired", "Aegunud"],
            ] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={clsx("-mb-px border-b-2 px-3 py-2.5 text-sm", tab === k ? "border-lime font-semibold" : "border-transparent text-muted hover:text-ink")}>
                {l} ({cards.filter(groups[k]).length})
              </button>
            ))}
          </nav>
          <Button size="sm" variant="primary" className="mb-2" onClick={() => { setState(null); setSelling({ valueCents: 5000, valueText: "50,00", buyerName: "", buyerEmail: "", recipientName: "", recipientEmail: "", message: "", paymentMethod: "kaart" }); }}>
            <Gift size={15} /> Müü kinkekaart
          </Button>
        </div>
        <FormMessage state={state?.ok ? state : null} />
        <div className="overflow-x-auto rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-[#f9fafb] text-left text-xs font-semibold tracking-[0.3px] text-[#475467] uppercase">
              <tr>
                <th className="py-3 pl-5 font-semibold">Kood</th>
                <th className="py-3 font-semibold">Ostja → saaja</th>
                <th className="py-3 font-semibold">Väärtus</th>
                <th className="py-3 font-semibold">Saldo</th>
                <th className="py-3 font-semibold">Kehtib kuni</th>
                <th className="py-3 font-semibold">Staatus</th>
                <th className="py-3 pr-5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="border-t border-line-soft">
                  <td className="py-3 pl-5 font-mono text-[13px] font-medium">{c.code}</td>
                  <td className="py-3">
                    <p>{c.buyer}</p>
                    <p className="text-xs text-muted">→ {c.recipient}</p>
                  </td>
                  <td className="py-3 tabular-nums">{formatEuro(c.valueCents, { decimals: true })}</td>
                  <td className="py-3 tabular-nums">{formatEuro(c.balanceCents, { decimals: true })} jääk</td>
                  <td className="py-3">{c.expires}</td>
                  <td className="py-3">
                    <Badge tone={STATUS[c.status].tone}>{c.status === "EXPIRING" ? `Aegub ${c.daysLeft} p` : STATUS[c.status].label}</Badge>
                  </td>
                  <td className="py-3 pr-5 text-right">
                    {(c.status === "ACTIVE" || c.status === "EXPIRING") && (
                      <Button size="sm" onClick={() => { setState(null); setRedeeming({ card: c, amount: "", note: "" }); }}>
                        Kasuta saldot
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted">
                    Kinkekaarte pole.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Card>
        <CardHeader title="Müük vidinas" action={<Switch checked={cfg.giftCardsEnabled} onChange={(v) => saveCfg({ ...cfg, giftCardsEnabled: v })} label="Müü kinkekaarte vidinas" />} />
        <div className={clsx("space-y-4 p-5", !cfg.giftCardsEnabled && "opacity-50")}>
          <p className="text-[13px] text-muted">Nupp „Kinkekaardid“ ilmub vidina avavaatesse.</p>
          <Field label="Summad">
            <div className="flex flex-wrap items-center gap-2">
              {cfg.giftCardAmounts.map((a) => (
                <span key={a} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-sm">
                  {formatEuro(a)}
                  <button type="button" aria-label={`Eemalda ${formatEuro(a)}`} onClick={() => saveCfg({ ...cfg, giftCardAmounts: cfg.giftCardAmounts.filter((x) => x !== a) })}>
                    <X size={13} />
                  </button>
                </span>
              ))}
              {cfg.giftCardAmounts.length < 6 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const c = parseEuroToCents(newAmount);
                    if (c && !cfg.giftCardAmounts.includes(c)) saveCfg({ ...cfg, giftCardAmounts: [...cfg.giftCardAmounts, c] });
                    setNewAmount("");
                  }}
                  className="flex items-center gap-1"
                >
                  <UnitInput unit="€" className="w-[90px]" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} aria-label="Uus summa" placeholder="150" />
                  <button type="submit" aria-label="Lisa summa" className="grid size-8 place-items-center rounded-lg hover:bg-line-soft">
                    <Plus size={15} />
                  </button>
                </form>
              )}
            </div>
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Vaba summa</span>
            <Switch checked={cfg.giftCardCustomAmount} onChange={(v) => saveCfg({ ...cfg, giftCardCustomAmount: v })} label="Vaba summa" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kehtivus" htmlFor="gValid">
              <Select id="gValid" value={cfg.giftCardValidityMonths} onChange={(e) => saveCfg({ ...cfg, giftCardValidityMonths: Number(e.target.value) })}>
                {[6, 12, 24, 36].map((m) => (
                  <option key={m} value={m}>
                    {m} kuud
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Min. vaba summa" htmlFor="gMin">
              <UnitInput unit="€" id="gMin" defaultValue={centsToInput(cfg.giftCardMinCents)} onBlur={(e) => { const c = parseEuroToCents(e.target.value); if (c && c !== cfg.giftCardMinCents) saveCfg({ ...cfg, giftCardMinCents: c }); }} />
            </Field>
          </div>
          <Field label="Kujundus">
            <div className="rounded-[12px] bg-gradient-to-br from-[#0f766e] to-[#115e59] p-4 text-white">
              <p className="text-[11px] font-semibold tracking-[1px] opacity-80">KINKEKAART</p>
              <p className="mt-6 text-xl font-bold">{formatEuro(cfg.giftCardAmounts[1] ?? cfg.giftCardAmounts[0] ?? 5000)}</p>
              <p className="text-xs opacity-80">{businessName}</p>
            </div>
          </Field>
          <p className="text-[13px] text-muted">Kasutatav makseviisina: kõik teenused ja paketid.</p>
          <FormMessage state={cfgState?.ok ? null : cfgState} />
        </div>
      </Card>

      <Dialog
        open={!!selling}
        onClose={() => setSelling(null)}
        title="Müü kinkekaart"
        subtitle="Kohapeal või telefoni teel müüdud kinkekaart"
        footer={
          <>
            <Button onClick={() => setSelling(null)}>Tühista</Button>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => { const r = await sellGiftCard(selling!); setState(r); if (r?.ok) setSelling(null); })}>
              Loo kinkekaart
            </Button>
          </>
        }
      >
        {selling && (
          <div className="space-y-4">
            <FormMessage state={state?.ok ? null : state} />
            <Field label="Väärtus">
              <div className="flex flex-wrap gap-2">
                {cfg.giftCardAmounts.map((a) => (
                  <button key={a} type="button" aria-pressed={selling.valueCents === a} onClick={() => setSelling({ ...selling, valueCents: a, valueText: centsToInput(a) })} className={clsx("h-10 rounded-[10px] border px-4 text-sm font-semibold", selling.valueCents === a ? "border-lime bg-lime-soft" : "border-line")}>
                    {formatEuro(a)}
                  </button>
                ))}
                <UnitInput unit="€" className="w-[120px]" value={selling.valueText} onChange={(e) => setSelling({ ...selling, valueText: e.target.value, valueCents: parseEuroToCents(e.target.value) ?? 0 })} aria-label="Muu summa" />
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ostja nimi" htmlFor="gBuyer">
                <Input id="gBuyer" value={selling.buyerName} onChange={(e) => setSelling({ ...selling, buyerName: e.target.value })} />
              </Field>
              <Field label="Ostja e-post" htmlFor="gBuyerEmail">
                <Input id="gBuyerEmail" type="email" value={selling.buyerEmail} onChange={(e) => setSelling({ ...selling, buyerEmail: e.target.value })} />
              </Field>
              <Field label="Saaja nimi" htmlFor="gRec">
                <Input id="gRec" value={selling.recipientName} onChange={(e) => setSelling({ ...selling, recipientName: e.target.value })} />
              </Field>
              <Field label="Saaja e-post" htmlFor="gRecEmail" hint="Saldo seotakse kliendikaardiga">
                <Input id="gRecEmail" type="email" value={selling.recipientEmail} onChange={(e) => setSelling({ ...selling, recipientEmail: e.target.value })} />
              </Field>
            </div>
            <Field label="Sõnum (valikuline)" htmlFor="gMsg">
              <Textarea id="gMsg" rows={2} value={selling.message} onChange={(e) => setSelling({ ...selling, message: e.target.value })} />
            </Field>
            <Field label="Makstud" htmlFor="gPay">
              <Select id="gPay" value={selling.paymentMethod} onChange={(e) => setSelling({ ...selling, paymentMethod: e.target.value as SellInput["paymentMethod"] })}>
                <option value="kaart">Kaardiga kohapeal</option>
                <option value="sularaha">Sularahas</option>
                <option value="ülekanne">Ülekandega</option>
              </Select>
            </Field>
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!redeeming}
        onClose={() => setRedeeming(null)}
        title={`Kasuta saldot · ${redeeming?.card.code ?? ""}`}
        subtitle={redeeming ? `Saadaval ${formatEuro(redeeming.card.balanceCents, { decimals: true })}` : undefined}
        footer={
          <>
            <Button onClick={() => setRedeeming(null)}>Tühista</Button>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => { const r = await redeemGiftCard(redeeming!.card.id, parseEuroToCents(redeeming!.amount) ?? 0, redeeming!.note); setState(r); if (r?.ok) setRedeeming(null); })}>
              <Minus size={15} /> Arvesta maha
            </Button>
          </>
        }
      >
        {redeeming && (
          <div className="space-y-4">
            <FormMessage state={state?.ok ? null : state} />
            <Field label="Summa" htmlFor="rAmount">
              <UnitInput unit="€" id="rAmount" value={redeeming.amount} onChange={(e) => setRedeeming({ ...redeeming, amount: e.target.value })} placeholder={centsToInput(redeeming.card.balanceCents)} />
            </Field>
            <Field label="Märge" htmlFor="rNote">
              <Input id="rNote" value={redeeming.note} onChange={(e) => setRedeeming({ ...redeeming, note: e.target.value })} placeholder="nt Näohooldus 12.11" />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
