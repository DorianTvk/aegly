"use client";

import { ImageField } from "@/components/ui/ImageField";
import { useFormAction } from "@/components/ui/use-form-action";
import Link from "next/link";
import { useState } from "react";
import { Check, ImageIcon, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, Textarea, Toggle, UnitInput } from "@/components/ui/form";
import { centsToInput } from "@/lib/money";
import { deleteService, saveService } from "./actions";

type PriceType = "FIXED" | "FROM" | "FREE" | "HIDDEN";

export type EditorService = {
  id: string | null;
  name: string;
  categoryId: string | null;
  description: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferMinutes: number;
  priceType: PriceType;
  priceCents: number;
  vatRate: string | null;
  depositPercent: number;
  bookableOnline: boolean;
  showPrice: boolean;
  allowStaffChoice: boolean;
  maxParticipants: number;
  minLeadMinutes: number | null;
  maxAdvanceDays: number | null;
  cancelUntilHours: number | null;
  staff: { staffId: string; priceCents: number | null; durationMinutes: number | null }[];
  subtitle?: string;
};

type Props = {
  service: EditorService;
  categories: { id: string; name: string }[];
  staff: { id: string; name: string; title: string | null; color: string }[];
  defaults: { minLeadMinutes: number; maxAdvanceDays: number; cancelUntilHours: number; vatRate: string };
  related?: { packages: string[]; campaigns: string[]; codes: string[] };
};

const PRICE_TYPES: { value: PriceType; label: string }[] = [
  { value: "FIXED", label: "Fikseeritud" },
  { value: "FROM", label: "Alates" },
  { value: "FREE", label: "Tasuta" },
  { value: "HIDDEN", label: "Peidetud" },
];

const LEAD_OPTIONS = [0, 30, 60, 120, 240, 720, 1440, 2880];
const ADVANCE_OPTIONS = [7, 14, 30, 60, 90, 180, 365];
const CANCEL_OPTIONS = [0, 2, 6, 12, 24, 48, 72];

const leadLabel = (m: number) => (m === 0 ? "Pole piirangut" : m < 60 ? `${m} min` : m < 1440 ? `${m / 60} tundi` : `${m / 1440} päeva`);
const cancelLabel = (h: number) => (h === 0 ? "Igal ajal" : `${h} h enne algust`);

export function ServiceEditor({ service, categories, staff, defaults, related }: Props) {
  const action = saveService.bind(null, service.id);
  const [state, formAction, pending] = useFormAction(action);
  const e = state?.errors ?? {};
  const [priceType, setPriceType] = useState<PriceType>(service.priceType);
  const [basePrice, setBasePrice] = useState(service.id === null ? "" : centsToInput(service.priceCents));
  const [duration, setDuration] = useState(String(service.durationMinutes));
  const [selected, setSelected] = useState(() => new Set(service.staff.map((x) => x.staffId)));
  const linkFor = (id: string) => service.staff.find((x) => x.staffId === id);
  const isNew = service.id === null;

  return (
    <form onSubmit={formAction} className="space-y-6">
      <PageHeader
        title={isNew ? "Uus teenus" : service.name}
        subtitle={service.subtitle}
        actions={
          <>
            <Link href="/teenused" className="inline-flex h-10 items-center rounded-[10px] border border-line bg-white px-3.5 text-sm font-semibold hover:bg-[#f9fafb]">
              Tühista
            </Link>
            <Button type="submit" variant="primary" disabled={pending}>
              <Check size={16} strokeWidth={2.5} />
              {pending ? "Salvestan…" : isNew ? "Lisa teenus" : "Salvesta muudatused"}
            </Button>
          </>
        }
      />
      <FormMessage state={state} />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Põhiandmed" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_220px]">
              <Field label="Teenuse nimi" htmlFor="name" error={e.name}>
                <Input id="name" name="name" defaultValue={service.name} required aria-invalid={!!e.name} />
              </Field>
              <Field label="Kategooria" htmlFor="categoryId" error={e.categoryId}>
                <Select id="categoryId" name="categoryId" defaultValue={service.categoryId ?? ""}>
                  <option value="">Kategooriata</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kirjeldus (kuvatakse vidinas)" htmlFor="description" className="sm:col-span-2" error={e.description}>
                <Textarea id="description" name="description" defaultValue={service.description ?? ""} rows={3} />
              </Field>
              <div className="sm:col-span-2">
                <ImageField name="image" currentUrl={service.imageUrl} width={800} height={600} label="Teenuse pilt (valikuline)" hint="Kuvatakse vidinas teenuse juures · JPG, PNG või HEIC" />
                {e.image && <p className="mt-1 text-xs text-bad">{e.image[0]}</p>}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Kestus ja puhveraeg" subtitle="Puhveraeg blokeerib kalendris aega, kuid ei ole kliendile nähtav" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
              <Field label="Kestus" htmlFor="durationMinutes" error={e.durationMinutes}>
                <UnitInput unit="min" id="durationMinutes" name="durationMinutes" type="number" min={5} step={5} value={duration} onChange={(ev) => setDuration(ev.target.value)} />
              </Field>
              <Field label="Puhveraeg enne" htmlFor="bufferBeforeMinutes" error={e.bufferBeforeMinutes}>
                <UnitInput unit="min" id="bufferBeforeMinutes" name="bufferBeforeMinutes" type="number" min={0} step={5} defaultValue={service.bufferBeforeMinutes} />
              </Field>
              <Field label="Puhveraeg pärast" htmlFor="bufferMinutes" hint="Aeg ruumi ettevalmistuseks" error={e.bufferMinutes}>
                <UnitInput unit="min" id="bufferMinutes" name="bufferMinutes" type="number" min={0} step={5} defaultValue={service.bufferMinutes} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Hind" subtitle="Hinnareeglid (nädalavahetus, õhtune aeg) lisanduvad hinnakirjast" />
            <div className="space-y-4 p-5">
              <fieldset>
                <legend className="mb-1.5 text-[13px] font-medium">Hinna tüüp</legend>
                <div className="inline-flex rounded-[10px] bg-line-soft p-0.5">
                  {PRICE_TYPES.map((pt) => (
                    <label key={pt.value} className={clsx("cursor-pointer rounded-lg px-3 py-1.5 text-[13px]", priceType === pt.value ? "bg-white font-semibold shadow-sm" : "text-muted")}>
                      <input type="radio" name="priceType" value={pt.value} checked={priceType === pt.value} onChange={() => setPriceType(pt.value)} className="sr-only" />
                      {pt.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label={priceType === "FROM" ? "Hind alates" : "Hind"} htmlFor="price" error={e.price}>
                  <UnitInput unit="€" id="price" name="price" inputMode="decimal" value={priceType === "FREE" ? "0,00" : basePrice} disabled={priceType === "FREE"} onChange={(ev) => setBasePrice(ev.target.value)} aria-invalid={!!e.price} />
                </Field>
                <Field label="Käibemaks" htmlFor="vatRate">
                  <Select id="vatRate" name="vatRate" defaultValue={service.vatRate ?? "default"}>
                    <option value="default">Ettevõtte vaikimisi ({Number(defaults.vatRate)}%)</option>
                    <option value="24">24% (sisaldub hinnas)</option>
                    <option value="13">13%</option>
                    <option value="9">9%</option>
                    <option value="0">0% (KM-ta)</option>
                  </Select>
                </Field>
                <Field label="Ettemaks" htmlFor="depositPercent" hint="Nõutakse broneerimisel" error={e.depositPercent}>
                  <UnitInput unit="%" id="depositPercent" name="depositPercent" type="number" min={0} max={100} defaultValue={service.depositPercent} disabled={priceType === "FREE"} />
                </Field>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Töötajad" subtitle="Vali, kes seda teenust osutab. Iga töötaja jaoks saab määrata eraldi hinna ja kestuse." />
            <ul className="divide-y divide-line-soft px-5">
              {staff.map((m) => {
                const on = selected.has(m.id);
                const link = linkFor(m.id);
                const custom = link?.priceCents != null;
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-3.5">
                    <input
                      type="checkbox"
                      name="staff"
                      value={m.id}
                      checked={on}
                      onChange={(ev) => {
                        const next = new Set(selected);
                        if (ev.target.checked) next.add(m.id);
                        else next.delete(m.id);
                        setSelected(next);
                      }}
                      className="size-[18px] accent-[#a3e635]"
                      aria-label={m.name}
                    />
                    <Avatar name={m.name} color={m.color} size={30} />
                    <div className={clsx("min-w-[140px] flex-1", !on && "opacity-50")}>
                      <p className="text-sm font-medium">{m.name}</p>
                      {m.title && <p className="text-xs text-muted">{m.title}</p>}
                    </div>
                    {on && (custom ? <span className="rounded-full bg-lime-soft px-2.5 py-1 text-xs font-semibold">Kohandatud hind</span> : <span className="text-xs text-muted">Baashind</span>)}
                    <UnitInput
                      unit="€"
                      name={`staffPrice_${m.id}`}
                      inputMode="decimal"
                      disabled={!on}
                      placeholder={on ? basePrice : "—"}
                      defaultValue={custom ? centsToInput(link!.priceCents) : ""}
                      className="w-[110px]"
                      aria-label={`${m.name} hind`}
                    />
                    <UnitInput
                      unit="min"
                      name={`staffDuration_${m.id}`}
                      type="number"
                      disabled={!on}
                      placeholder={on ? duration : "—"}
                      defaultValue={link?.durationMinutes ?? ""}
                      className="w-[100px]"
                      aria-label={`${m.name} kestus`}
                    />
                  </li>
                );
              })}
              {staff.length === 0 && (
                <li className="py-6 text-sm text-muted">
                  Töötajaid pole veel. <Link href="/tootajad" className="font-semibold text-ink underline">Lisa töötaja</Link>
                </li>
              )}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Nähtavus" />
            <div className="space-y-4 p-5">
              <Toggle name="bookableOnline" label="Online broneeritav" description="Kuvatakse broneerimisvidinas" defaultChecked={service.bookableOnline} />
              <Toggle name="showPrice" label="Näita hinda" defaultChecked={service.showPrice} />
              <Toggle name="allowStaffChoice" label="Kliendi töötaja valik" description="Klient saab valida töötaja" defaultChecked={service.allowStaffChoice} />
              <Field label="Osalejaid ühe broneeringu kohta" htmlFor="maxParticipants">
                <Select id="maxParticipants" name="maxParticipants" defaultValue={service.maxParticipants}>
                  {[1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Broneerimisreeglid" subtitle="Tühjaks jättes kehtib ettevõtte üldreegel" />
            <div className="space-y-4 p-5">
              <Field label="Min. etteteatamisaeg" htmlFor="minLeadMinutes">
                <Select id="minLeadMinutes" name="minLeadMinutes" defaultValue={service.minLeadMinutes ?? "default"}>
                  <option value="default">Üldreegel ({leadLabel(defaults.minLeadMinutes)})</option>
                  {LEAD_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {leadLabel(m)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Max. broneerimine ette" htmlFor="maxAdvanceDays">
                <Select id="maxAdvanceDays" name="maxAdvanceDays" defaultValue={service.maxAdvanceDays ?? "default"}>
                  <option value="default">Üldreegel ({defaults.maxAdvanceDays} päeva)</option>
                  {ADVANCE_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} päeva
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tasuta tühistamine" htmlFor="cancelUntilHours">
                <Select id="cancelUntilHours" name="cancelUntilHours" defaultValue={service.cancelUntilHours ?? "default"}>
                  <option value="default">Üldreegel ({cancelLabel(defaults.cancelUntilHours)})</option>
                  {CANCEL_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {cancelLabel(h)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          {related && (
            <Card>
              <CardHeader title="Seotud" />
              <dl className="space-y-2.5 p-5 text-sm">
                {(
                  [
                    ["Paketid", related.packages],
                    ["Kampaaniad", related.campaigns],
                    ["Sooduskoodid", related.codes],
                  ] as const
                ).map(([label, list]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-muted">{label}</dt>
                    <dd className="text-right font-medium">{list.length ? list.join(", ") : "—"}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}

          {!isNew && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Kustutada see teenus? Kui teenusel on broneeringuid, see arhiveeritakse ja ajalugu jääb alles.")) void deleteService(service.id!);
              }}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[#fda29b] bg-white text-sm font-semibold text-bad hover:bg-bad-bg"
            >
              <Trash2 size={16} />
              Kustuta teenus
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
