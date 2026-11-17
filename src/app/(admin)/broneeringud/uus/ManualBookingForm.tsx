"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, Search, UserPlus, X } from "lucide-react";
import { clsx } from "clsx";
import { Avatar } from "@/components/ui/Avatar";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, Textarea, UnitInput, type FormState } from "@/components/ui/form";
import { Segmented, Switch } from "@/components/ui/pickers";
import { centsToInput, parseEuroToCents } from "@/lib/money";
import { formatEuro, formatShortDate } from "@/lib/time";
import { adminQuote, adminSlots, createManualBooking, searchClients } from "../actions";

type Service = { id: string; name: string; durationMinutes: number; priceCents: number; staffIds: string[] };
type Staff = { id: string; name: string; color: string };
type ClientHit = { id: string; name: string; email: string | null; phone: string | null; visits: number };

export function ManualBookingForm({
  services,
  staff,
  initial,
  initialClient,
}: {
  services: Service[];
  staff: Staff[];
  initial: { date: string; staffId: string | null; time: string | null; serviceId: string | null };
  initialClient: ClientHit | null;
}) {
  const router = useRouter();
  const [client, setClient] = useState<ClientHit | null>(initialClient);
  const [newClient, setNewClient] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [serviceId, setServiceId] = useState(initial.serviceId ?? services.find((s) => !initial.staffId || s.staffIds.includes(initial.staffId))?.id ?? "");
  const [staffId, setStaffId] = useState<string>(initial.staffId ?? "any");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState<string | null>(initial.time);
  const [slots, setSlots] = useState<{ time: string; staffIds: string[] }[] | null>(null);
  const [slotReason, setSlotReason] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof adminQuote>>>(null);
  const [priceText, setPriceText] = useState<string | null>(null);
  const [payment, setPayment] = useState<"ON_SITE" | "LINK" | "PAID">("ON_SITE");
  const [note, setNote] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState(true);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const [, startLoad] = useTransition();

  const service = services.find((s) => s.id === serviceId);
  const allowedStaff = staff.filter((m) => service?.staffIds.includes(m.id));
  const staffParam = staffId === "any" ? null : staffId;

  // kliendi otsing
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => startLoad(async () => setHits(await searchClients(q))), 200);
    return () => clearTimeout(t);
  }, [q]);

  // vabad ajad
  useEffect(() => {
    if (!serviceId) return;
    startLoad(async () => {
      const r = await adminSlots(serviceId, staffParam, date);
      setSlots(r.slots);
      setSlotReason(r.reason);
    });
  }, [serviceId, staffParam, date]);

  // hind
  useEffect(() => {
    if (!serviceId || !time) return;
    const slotStaff = staffParam ?? slots?.find((x) => x.time === time)?.staffIds[0] ?? null;
    startLoad(async () => {
      setQuote(await adminQuote(serviceId, slotStaff, date, time, code.trim() || null, client?.email ?? (newClient?.email || null)));
      setPriceText(null);
    });
  }, [serviceId, staffParam, date, time, code, client, newClient, slots]);

  const timeValid = !!time && !!slots?.some((x) => x.time === time);
  const finalCents = priceText !== null ? parseEuroToCents(priceText) : (quote?.finalCents ?? null);

  const submit = () =>
    start(async () => {
      const r = await createManualBooking({
        serviceId,
        staffId: staffParam,
        date,
        time: time ?? "",
        clientId: client?.id ?? null,
        newClient: !client && newClient ? newClient : null,
        code: code.trim() || null,
        priceOverrideCents: priceText !== null ? finalCents : null,
        payment,
        note: note.trim() || null,
      });
      setState(r);
      if (r?.ok && r.bookingId) router.push(`/broneeringud/${r.bookingId}`);
    });

  return (
    <Card className="max-w-[860px]">
      <CardHeader title="Käsitsi broneering" subtitle="Telefoni teel või kohapeal tehtud broneering. Etteteatamisaja piirang siin ei kehti." />
      <div className="space-y-5 p-5">
        <FormMessage state={state} />

        <Field label="Klient">
          {client ? (
            <div className="flex items-center gap-3 rounded-[10px] border border-lime bg-lime-soft/60 p-3">
              <Avatar name={client.name} color="#7a5af8" size={34} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{client.name}</p>
                <p className="text-xs text-muted">{[client.phone, client.email, `${client.visits} külastust`].filter(Boolean).join(" · ")}</p>
              </div>
              <button type="button" aria-label="Vaheta klienti" onClick={() => { setClient(null); setQ(""); setHits([]); }} className="grid size-8 place-items-center rounded-lg hover:bg-white">
                <X size={16} />
              </button>
            </div>
          ) : newClient ? (
            <div className="space-y-3 rounded-[10px] border border-line p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Uus klient</p>
                <button type="button" onClick={() => setNewClient(null)} className="text-[13px] text-muted hover:text-ink">
                  Otsi olemasolevat
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input placeholder="Nimi" aria-label="Kliendi nimi" value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} />
                <Input placeholder="Telefon" aria-label="Kliendi telefon" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                <Input placeholder="E-post" type="email" aria-label="Kliendi e-post" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
              </div>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-2">
                <label className="relative flex-1">
                  <Search size={16} className="absolute top-1/2 left-3 -translate-y-1/2 text-subtle" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Otsi nime või telefoni järgi"
                    aria-label="Otsi klienti"
                    className="h-10 w-full rounded-[10px] border border-line bg-white pr-3 pl-9 text-sm outline-none focus:border-lime focus:ring-3 focus:ring-lime/30"
                  />
                </label>
                <Button onClick={() => setNewClient({ name: q, email: "", phone: "" })}>
                  <UserPlus size={16} /> Uus klient
                </Button>
              </div>
              {q.trim().length >= 2 && hits.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-[10px] border border-line bg-white shadow-lg">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button type="button" onClick={() => setClient(h)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-line-soft">
                        <Avatar name={h.name} color="#7a5af8" />
                        <span className="flex-1 text-sm">
                          {h.name} <span className="text-muted">· {h.phone ?? h.email}</span>
                        </span>
                        <span className="text-xs text-muted">{h.visits} külastust</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Teenus" htmlFor="mService">
            <Select id="mService" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setTime(null); setStaffId("any"); }}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMinutes} min · {formatEuro(s.priceCents, { decimals: true })}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Töötaja" htmlFor="mStaff">
            <Select id="mStaff" value={staffId} onChange={(e) => { setStaffId(e.target.value); setTime(null); }}>
              <option value="any">Ükskõik kes</option>
              {allowedStaff.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kuupäev" htmlFor="mDate">
            <Input id="mDate" type="date" value={date} onChange={(e) => { setDate(e.target.value); setTime(null); }} />
          </Field>
        </div>

        <Field label="Vabad ajad" hint={slots && slots.length ? `${formatShortDate(date)} · vali algusaeg` : undefined}>
          {slots === null ? (
            <p className="text-sm text-muted">Laen…</p>
          ) : slots.length === 0 ? (
            <p className="rounded-[10px] bg-line-soft px-3 py-3 text-sm text-muted">
              {slotReason === "closed" ? "Sel päeval on suletud." : slotReason === "no-staff" ? "Sellele teenusele pole töötajat määratud." : slotReason === "past" ? "See päev on möödas." : "Vabu aegu pole – päev on täis."}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
              {slots.map((x) => (
                <button
                  key={x.time}
                  type="button"
                  aria-pressed={time === x.time}
                  onClick={() => setTime(x.time)}
                  className={clsx("h-9 rounded-lg border text-sm tabular-nums", time === x.time ? "border-lime bg-lime font-semibold" : "border-line hover:border-[#d0d5dd] hover:bg-[#f9fafb]")}
                >
                  {x.time}
                </button>
              ))}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Sooduskood" htmlFor="mCode" error={quote?.codeError ?? undefined}>
            <Input id="mCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Puudub" className="font-mono" />
          </Field>
          <Field label="Hind" htmlFor="mPrice" hint={priceText !== null ? "Käsitsi muudetud" : "Arvutatud reeglite järgi"}>
            <UnitInput unit="€" id="mPrice" inputMode="decimal" value={priceText ?? centsToInput(quote?.finalCents ?? service?.priceCents ?? 0)} onChange={(e) => setPriceText(e.target.value)} />
          </Field>
          <Field label="Makse">
            <Segmented
              value={payment}
              onChange={(p) => setPayment(p === "LINK" ? "ON_SITE" : p)}
              options={[{ value: "ON_SITE", label: "Kohapeal" }, { value: "PAID", label: "Makstud" }]}
            />
          </Field>
        </div>

        {quote && quote.lines.length > 1 && (
          <ul className="space-y-1 rounded-[10px] bg-[#f9fafb] p-3 text-[13px]">
            {quote.lines.map((l, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-muted">{l.label}</span>
                <span className="tabular-nums">{i === 0 ? formatEuro(l.amountCents, { decimals: true }) : `${l.amountCents > 0 ? "+" : ""}${formatEuro(l.amountCents, { decimals: true })}`}</span>
              </li>
            ))}
          </ul>
        )}

        <Field label="Märge (valikuline)" htmlFor="mNote">
          <Textarea id="mNote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="nt klient soovib aknapoolset kabinetti" />
        </Field>

        <div className="flex items-center justify-between gap-4 rounded-[10px] border border-line p-3">
          <span>
            <span className="block text-sm font-medium">Saada kliendile kinnitus</span>
            <span className="text-[13px] text-muted">E-post ja SMS koos muutmise lingiga · lisandub koos teavitustega</span>
          </span>
          <Switch checked={sendConfirmation} onChange={setSendConfirmation} label="Saada kliendile kinnitus" />
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-4">
        <Button onClick={() => router.back()}>Tühista</Button>
        <Button variant="primary" disabled={pending || !timeValid || (!client && !newClient) || finalCents === null} onClick={submit}>
          <Check size={16} strokeWidth={2.5} /> {pending ? "Loon…" : "Loo broneering"}
        </Button>
      </div>
    </Card>
  );
}
