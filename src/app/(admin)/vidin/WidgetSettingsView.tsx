"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, MapPin, Megaphone, Plus, X } from "lucide-react";
import { clsx } from "clsx";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, type FormState } from "@/components/ui/form";
import { Segmented, Switch } from "@/components/ui/pickers";
import { saveWidgetSettings, type WidgetSettings } from "./actions";

const PRESETS = [
  { name: "Mets", primary: "#0f766e" },
  { name: "Öö", primary: "#1f2937" },
  { name: "Laim", primary: "#4d7c0f" },
  { name: "Roos", primary: "#be185d" },
  { name: "Ookean", primary: "#1d4ed8" },
  { name: "Liiv", primary: "#b45309" },
];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <label className="flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" aria-label={label} />
        <input value={value.toUpperCase()} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)} className="w-full bg-transparent font-mono text-sm outline-none" aria-label={`${label} kood`} />
      </label>
    </Field>
  );
}

export function WidgetSettingsView({
  initial,
  business,
  appUrl,
  installedAt,
  campaignBanner,
}: {
  initial: WidgetSettings;
  business: { slug: string; name: string; address: string | null; logoUrl: string | null; bannerUrl: string | null };
  appUrl: string;
  installedAt: string | null;
  campaignBanner: string | null;
}) {
  const [v, setV] = useState(initial);
  const [tab, setTab] = useState<"popup" | "iframe" | "wordpress">(initial.widgetEmbed);
  const [newDomain, setNewDomain] = useState("");
  const [copied, setCopied] = useState(false);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof WidgetSettings>(k: K, val: WidgetSettings[K]) => setV((p) => ({ ...p, [k]: val }));

  const dark = v.widgetTheme === "dark";
  const bg = dark ? "#111827" : v.widgetBackground;
  const fg = dark ? "#f9fafb" : v.widgetTextColor;

  const snippets = {
    popup: `<script src="${appUrl}/w/aegly.js" data-salon="${business.slug}" data-button="${v.widgetButtonText}" async></script>`,
    iframe: `<iframe src="${appUrl}/w/${business.slug}" title="Broneeri aeg – ${business.name}"\n  style="width:100%;max-width:480px;height:760px;border:0;border-radius:16px" loading="lazy"></iframe>`,
    wordpress: `[aegly salon="${business.slug}"]\n\n<!-- Kui lühikoodi plugin puudub, lisa see plokk "Kohandatud HTML" plokina: -->\n<script src="${appUrl}/w/aegly.js" data-salon="${business.slug}" async></script>`,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Broneerimisvidin"
        subtitle="Kohanda vidina välimus oma kodulehega ja lisa see lehele ühe koodireaga."
        actions={
          <>
            <a href={`${appUrl}/w/${business.slug}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-line bg-white px-3.5 text-sm font-semibold hover:bg-[#f9fafb]">
              <ExternalLink size={16} /> Ava testleht
            </a>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => setState(await saveWidgetSettings({ ...v, widgetEmbed: tab === "iframe" ? "iframe" : "popup" })))}>
              <Check size={16} strokeWidth={2.5} /> Avalda muudatused
            </Button>
          </>
        }
      />
      <FormMessage state={state} />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Logo ja bänner" subtitle="Pärineb ettevõtte profiilist" />
            <div className="space-y-3 p-5">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">Kuva logo</span><Switch checked={v.widgetShowLogo} onChange={(x) => set("widgetShowLogo", x)} label="Kuva logo" /></div>
              <div className="flex items-center justify-between"><span className="text-sm font-medium">Kuva bänner</span><Switch checked={v.widgetShowBanner} onChange={(x) => set("widgetShowBanner", x)} label="Kuva bänner" /></div>
              <Link href="/profiil" className="text-[13px] font-semibold underline-offset-4 hover:underline">Muuda ettevõtte profiilis →</Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Värvid" />
            <div className="space-y-4 p-5">
              <Field label="Kiirvalikud">
                <div className="flex gap-2">
                  {PRESETS.map((p) => (
                    <button key={p.name} type="button" title={p.name} aria-label={p.name} aria-pressed={v.widgetPrimary === p.primary} onClick={() => set("widgetPrimary", p.primary)} className="size-8 rounded-full ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-ink" style={{ background: p.primary }} />
                  ))}
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Põhivärv" value={v.widgetPrimary} onChange={(x) => set("widgetPrimary", x)} />
                <ColorField label="Nupu tekst" value={v.widgetButtonColor} onChange={(x) => set("widgetButtonColor", x)} />
                <ColorField label="Taust" value={v.widgetBackground} onChange={(x) => set("widgetBackground", x)} />
                <ColorField label="Tekst" value={v.widgetTextColor} onChange={(x) => set("widgetTextColor", x)} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Stiil ja sisu" />
            <div className="space-y-4 p-5">
              <Field label="Teema">
                <Segmented value={v.widgetTheme} onChange={(x) => set("widgetTheme", x)} options={[{ value: "light", label: "Hele" }, { value: "dark", label: "Tume" }, { value: "auto", label: "Automaatne" }]} />
              </Field>
              <Field label="Font" htmlFor="wFont">
                <Select id="wFont" value={v.widgetFont} onChange={(e) => set("widgetFont", e.target.value as WidgetSettings["widgetFont"])}>
                  <option value="inherit">Päri kodulehelt</option>
                  <option value="Inter">Inter</option>
                  <option value="system">Süsteemi font</option>
                </Select>
              </Field>
              <Field label="Nupu tekst kodulehel" htmlFor="wBtn">
                <Input id="wBtn" value={v.widgetButtonText} maxLength={30} onChange={(e) => set("widgetButtonText", e.target.value)} />
              </Field>
              <div className="space-y-3 border-t border-line-soft pt-4">
                <div className="flex items-center justify-between"><span className="text-sm font-medium">Kuva hinnad</span><Switch checked={v.widgetShowPrices} onChange={(x) => set("widgetShowPrices", x)} label="Kuva hinnad" /></div>
                <div className="flex items-center justify-between"><span className="text-sm font-medium">Spetsialisti valik</span><Switch checked={v.widgetShowStaff} onChange={(x) => set("widgetShowStaff", x)} label="Spetsialisti valik" /></div>
                <div className="flex items-center justify-between"><span className="text-sm font-medium">Kampaania bänner</span><Switch checked={v.widgetShowCampaignBanner} onChange={(x) => set("widgetShowCampaignBanner", x)} label="Kampaania bänner" /></div>
              </div>
              <Field label="Keeled">
                <div className="flex gap-2">
                  {([["et", "Eesti"], ["en", "English"], ["ru", "Русский"]] as const).map(([code, label]) => {
                    const on = v.widgetLanguages.includes(code);
                    return (
                      <button key={code} type="button" aria-pressed={on} onClick={() => set("widgetLanguages", on ? v.widgetLanguages.filter((x) => x !== code) : [...v.widgetLanguages, code])} className={clsx("h-8 rounded-full border px-3 text-[13px] font-medium", on ? "border-lime bg-lime-soft" : "border-line")}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Eelvaade" subtitle="Samm 3 · Aja valik" />
            <div className="grid place-items-center bg-[#f2f4f7] p-6">
              <div className="w-[360px] overflow-hidden rounded-[18px] shadow-xl" style={{ background: bg, color: fg, fontFamily: v.widgetFont === "inherit" ? "Georgia, serif" : v.widgetFont === "Inter" ? "var(--font-sans)" : "system-ui" }}>
                {v.widgetShowBanner && (
                  <div className="h-16" style={{ background: business.bannerUrl ? `center/cover url(${business.bannerUrl})` : `linear-gradient(135deg, ${v.widgetPrimary}, #0b3b38)` }} />
                )}
                <div className="flex items-center gap-2.5 px-4 pt-3">
                  {v.widgetShowLogo && (
                    <span className="grid size-9 place-items-center overflow-hidden rounded-[10px] text-xs font-bold text-white" style={{ background: v.widgetPrimary }}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- kasutaja logo */}
                      {business.logoUrl ? <img src={business.logoUrl} alt="" className="size-full object-cover" /> : business.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold">{business.name}</p>
                    <p className="flex items-center gap-1 text-[11px] opacity-60"><MapPin size={10} /> {business.address ?? "Aadress"}</p>
                  </div>
                </div>
                {v.widgetShowCampaignBanner && campaignBanner && (
                  <p className="mx-4 mt-3 flex items-center gap-1.5 rounded-lg bg-[#fff4ed] px-2.5 py-1.5 text-[11px] font-semibold text-[#b93815]">
                    <Megaphone size={12} /> {campaignBanner}
                  </p>
                )}
                <div className="px-4 pt-3">
                  <div className="flex gap-1">{[1, 2, 3, 4, 5].map((i) => <span key={i} className="h-1 flex-1 rounded" style={{ background: i <= 3 ? v.widgetPrimary : `${fg}22` }} />)}</div>
                  <p className="mt-3 text-[15px] font-semibold">Vali aeg</p>
                  <p className="text-xs opacity-60">Klassikaline massaaž{v.widgetShowPrices ? " · 55 €" : ""}</p>
                  <div className="mt-3 grid grid-cols-6 gap-1.5">
                    {["E 2", "T 3", "K 4", "N 5", "R 6", "L 7"].map((d, i) => (
                      <span key={d} className="grid h-11 place-items-center rounded-lg border text-center text-[10px] leading-tight" style={i === 1 ? { background: v.widgetPrimary, color: v.widgetButtonColor, borderColor: v.widgetPrimary } : { borderColor: `${fg}22` }}>
                        {d.split(" ")[0]}<br /><b className="text-sm">{d.split(" ")[1]}</b>
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {["09:00", "09:15", "10:15", "10:30", "10:45", "13:00", "13:15", "13:30"].map((t) => (
                      <span key={t} className="grid h-8 place-items-center rounded-lg border text-xs" style={t === "10:30" ? { background: `${v.widgetPrimary}1a`, borderColor: v.widgetPrimary, fontWeight: 600 } : { borderColor: `${fg}22` }}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-4">
                  <span className="grid h-10 place-items-center rounded-full text-sm font-semibold" style={{ background: v.widgetPrimary, color: v.widgetButtonColor }}>
                    Jätka – T 3. nov kell 10:30
                  </span>
                  <p className="mt-2 text-center text-[10px] opacity-50">Toetab Aegly</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Paigalduskood" action={installedAt ? <Badge tone="ok">Tuvastatud {installedAt}</Badge> : <Badge tone="warn">Pole veel kodulehel tuvastatud</Badge>} />
            <div className="space-y-3 p-5">
              <Segmented value={tab} onChange={setTab} options={[{ value: "popup", label: "Nupp (pop-up) – soovitatud" }, { value: "iframe", label: "iframe" }, { value: "wordpress", label: "WordPress" }]} />
              <pre className="overflow-x-auto rounded-[10px] bg-ink p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-[#e5e7eb]">{snippets[tab]}</pre>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted">Värvi-, logo- ja bänneri muudatused rakenduvad kohe – koodi ei pea uuesti lisama.</p>
                <Button size="sm" onClick={() => { void navigator.clipboard.writeText(snippets[tab]); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Kopeeritud" : "Kopeeri kood"}
                </Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Lubatud domeenid" subtitle="Vidin töötab ainult nendel domeenidel, teistel saitidel see ei laadi" />
            <div className="space-y-2 p-5">
              {v.allowedDomains.map((d) => (
                <div key={d} className="flex items-center justify-between rounded-[10px] border border-line px-3 py-2 text-sm">
                  <span className="font-mono">{d}</span>
                  <button type="button" aria-label={`Eemalda ${d}`} onClick={() => set("allowedDomains", v.allowedDomains.filter((x) => x !== d))} className="text-muted hover:text-bad">
                    <X size={15} />
                  </button>
                </div>
              ))}
              {v.allowedDomains.length === 0 && <p className="text-sm text-warn">Domeene pole lisatud – vidin töötab praegu igal saidil.</p>}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = newDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
                  if (d && !v.allowedDomains.includes(d)) set("allowedDomains", [...v.allowedDomains, d]);
                  setNewDomain("");
                }}
                className="flex gap-2"
              >
                <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="www.minusalong.ee" aria-label="Uus domeen" />
                <Button type="submit">
                  <Plus size={15} /> Lisa domeen
                </Button>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
