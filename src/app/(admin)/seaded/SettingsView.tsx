"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CreditCard, Download, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { useFormAction } from "@/components/ui/use-form-action";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormMessage, Input, Select, type FormState } from "@/components/ui/form";
import { Switch } from "@/components/ui/pickers";
import { addUser, changePassword, deleteBusiness, removeUser, saveProtection, setUserRole, updateAccount } from "./actions";

type User = { id: string; name: string; email: string; role: "OWNER" | "ADMIN" | "STAFF"; isMe: boolean };
const ROLE = { OWNER: "Omanik", ADMIN: "Administraator", STAFF: "Töötaja" };

export function SettingsView({
  me,
  users,
  business,
}: {
  me: { name: string; email: string; role: User["role"] };
  users: User[];
  business: { name: string; noShowProtection: boolean; noShowThreshold: number; stripeAccountId: string | null; locale: string; currency: string; timezone: string };
}) {
  const [name, setName] = useState(me.name);
  const [accState, setAccState] = useState<FormState>(null);
  const [pwState, onPw, pwPending] = useFormAction(changePassword);
  const [prot, setProt] = useState({ noShowProtection: business.noShowProtection, noShowThreshold: business.noShowThreshold });
  const [protState, setProtState] = useState<FormState>(null);
  const [adding, setAdding] = useState<{ name: string; email: string; role: "ADMIN" | "STAFF" } | null>(null);
  const [addState, setAddState] = useState<(FormState & { tempPassword?: string }) | null>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delName, setDelName] = useState("");
  const [delState, setDelState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const owner = me.role === "OWNER";

  const saveProt = (next: typeof prot) => {
    setProt(next);
    start(async () => setProtState(await saveProtection(next)));
  };

  return (
    <div className="max-w-[920px] space-y-5">
      <PageHeader title="Seaded" subtitle="Konto, kasutajad, maksed ja andmed." />

      <Card>
        <CardHeader title="Minu konto" />
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Nimi" htmlFor="sName">
              <Input id="sName" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="E-post" htmlFor="sEmail" hint="Sisselogimise e-post">
              <Input id="sEmail" value={me.email} disabled />
            </Field>
            <div className="flex items-center gap-3">
              <Button size="sm" disabled={pending || name === me.name} onClick={() => start(async () => setAccState(await updateAccount({ name })))}>
                Salvesta nimi
              </Button>
              <FormMessage state={accState} />
            </div>
          </div>
          <form onSubmit={onPw} className="space-y-3">
            <Field label="Praegune parool" htmlFor="pwCur" error={pwState?.errors?.current}>
              <Input id="pwCur" name="current" type="password" autoComplete="current-password" />
            </Field>
            <Field label="Uus parool" htmlFor="pwNew" hint="Vähemalt 8 märki" error={pwState?.errors?.next}>
              <Input id="pwNew" name="next" type="password" autoComplete="new-password" />
            </Field>
            <div className="flex items-center gap-3">
              <Button size="sm" type="submit" disabled={pwPending}>
                Muuda parooli
              </Button>
              <FormMessage state={pwState?.ok ? pwState : null} />
            </div>
          </form>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Kasutajad ja rollid"
          subtitle="Administraator haldab kõike peale kasutajate ja konto. Töötaja näeb kalendrit ja broneeringuid."
          action={
            owner && (
              <Button size="sm" onClick={() => { setAddState(null); setAdding({ name: "", email: "", role: "STAFF" }); }}>
                <UserPlus size={15} /> Lisa kasutaja
              </Button>
            )
          }
        />
        <ul className="divide-y divide-line-soft">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <Avatar name={u.name} color="#7a5af8" size={32} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {u.name} {u.isMe && <span className="text-muted">(sina)</span>}
                </p>
                <p className="text-xs text-muted">{u.email}</p>
              </div>
              {u.role === "OWNER" || !owner ? (
                <Badge tone="neutral" dot={false}>{ROLE[u.role]}</Badge>
              ) : (
                <>
                  <Select className="w-[170px]" value={u.role} onChange={(e) => start(() => setUserRole(u.id, e.target.value as "ADMIN" | "STAFF"))} aria-label={`${u.name} roll`}>
                    <option value="ADMIN">Administraator</option>
                    <option value="STAFF">Töötaja</option>
                  </Select>
                  <button type="button" aria-label={`Eemalda ${u.name}`} onClick={() => { if (confirm(`Eemaldada ${u.name}?`)) start(() => removeUser(u.id)); }} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-bad-bg hover:text-bad">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Maksed ja kaitse" />
        <div className="space-y-5 p-5">
          <div className="flex items-start gap-3 rounded-[10px] border border-line p-4">
            <CreditCard size={20} className="mt-0.5 text-muted" />
            <div className="flex-1">
              <p className="text-sm font-medium">Stripe</p>
              <p className="text-[13px] text-muted">Kaardimaksed, Apple Pay ja Google Pay. Raha laekub otse sinu Stripe&apos;i kontole.</p>
            </div>
            <Badge tone="neutral">{business.stripeAccountId ? "Ühendatud" : "Lisandub maksetega"}</Badge>
          </div>
          <div className="flex items-start justify-between gap-4">
            <span className="flex gap-3">
              <ShieldAlert size={20} className="mt-0.5 text-muted" />
              <span>
                <span className="block text-sm font-medium">Mitteilmumise kaitse</span>
                <span className="text-[13px] text-muted">Kliendilt, kes on korduvalt ilmumata jätnud, nõutakse vidinas 100% ettemaksu.</span>
              </span>
            </span>
            <Switch checked={prot.noShowProtection} onChange={(x) => saveProt({ ...prot, noShowProtection: x })} label="Mitteilmumise kaitse" />
          </div>
          <Field label="Rakendub alates" htmlFor="sThreshold">
            <Select id="sThreshold" className="max-w-[320px]" disabled={!prot.noShowProtection} value={prot.noShowThreshold} onChange={(e) => saveProt({ ...prot, noShowThreshold: Number(e.target.value) })}>
              {[1, 2, 3, 5].map((n) => (
                <option key={n} value={n}>
                  {n} mitteilmumisest 12 kuu jooksul
                </option>
              ))}
            </Select>
          </Field>
          <FormMessage state={protState?.ok ? null : protState} />
          <p className="text-[13px] text-muted">
            Ettemaksu protsent määratakse iga teenuse juures (<Link href="/teenused" className="underline">Teenused</Link>), tühistamise ja broneerimise reeglid lehel <Link href="/tooajad" className="underline">Tööajad ja vabad ajad</Link>.
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Keel ja piirkond" />
        <dl className="grid grid-cols-1 gap-4 p-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Halduspaneeli keel</dt>
            <dd className="font-medium">Eesti</dd>
          </div>
          <div>
            <dt className="text-muted">Valuuta</dt>
            <dd className="font-medium">{business.currency} (€)</dd>
          </div>
          <div>
            <dt className="text-muted">Ajavöönd</dt>
            <dd className="font-medium">
              {business.timezone} · <Link href="/profiil" className="text-[13px] underline">muuda</Link>
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader title="Andmed ja privaatsus" subtitle="Sina oled oma klientide andmete vastutav töötleja, Aegly on volitatud töötleja." />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex flex-wrap gap-2">
            <a href="/kliendid/export" download className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border border-line px-2.5 text-[13px] font-semibold hover:bg-[#f9fafb]">
              <Download size={15} /> Kliendid (CSV)
            </a>
            <a href="/hinnakiri/export" download className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border border-line px-2.5 text-[13px] font-semibold hover:bg-[#f9fafb]">
              <Download size={15} /> Hinnakiri (CSV)
            </a>
          </div>
          {owner && (
            <Button size="sm" variant="ghost" className="text-bad" onClick={() => { setDelName(""); setDelState(null); setDelOpen(true); }}>
              <Trash2 size={15} /> Kustuta konto
            </Button>
          )}
        </div>
      </Card>

      <Dialog
        open={!!adding}
        onClose={() => setAdding(null)}
        title="Lisa kasutaja"
        subtitle="Kasutaja saab ajutise parooli, mille ta muudab pärast sisselogimist."
        footer={
          addState?.tempPassword ? (
            <Button variant="primary" onClick={() => setAdding(null)}>Valmis</Button>
          ) : (
            <>
              <Button onClick={() => setAdding(null)}>Tühista</Button>
              <Button variant="primary" disabled={pending} onClick={() => start(async () => setAddState(await addUser(adding!)))}>
                Lisa kasutaja
              </Button>
            </>
          )
        }
      >
        {adding && (
          addState?.tempPassword ? (
            <div className="space-y-3">
              <p className="text-sm">Kasutaja <b>{adding.email}</b> on lisatud. Edasta talle ajutine parool turvalisel viisil – seda ei näidata uuesti:</p>
              <p className="rounded-[10px] bg-line-soft px-4 py-3 text-center font-mono text-lg font-semibold">{addState.tempPassword}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <FormMessage state={addState} />
              <Field label="Nimi" htmlFor="uName">
                <Input id="uName" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
              </Field>
              <Field label="E-post" htmlFor="uEmail">
                <Input id="uEmail" type="email" value={adding.email} onChange={(e) => setAdding({ ...adding, email: e.target.value })} />
              </Field>
              <Field label="Roll" htmlFor="uRole">
                <Select id="uRole" value={adding.role} onChange={(e) => setAdding({ ...adding, role: e.target.value as "ADMIN" | "STAFF" })}>
                  <option value="STAFF">Töötaja</option>
                  <option value="ADMIN">Administraator</option>
                </Select>
              </Field>
            </div>
          )
        )}
      </Dialog>

      <Dialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Kustuta konto"
        subtitle="Kõik andmed – broneeringud, kliendid, teenused, töötajad – kustutatakse jäädavalt."
        footer={
          <>
            <Button onClick={() => setDelOpen(false)}>Tühista</Button>
            <Button className="border-danger bg-danger text-white hover:bg-[#d92d20]" disabled={pending || delName !== business.name} onClick={() => start(async () => setDelState(await deleteBusiness(delName)))}>
              Kustuta jäädavalt
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormMessage state={delState} />
          <p className="text-sm">
            Kinnitamiseks kirjuta ettevõtte nimi: <b>{business.name}</b>
          </p>
          <Input value={delName} onChange={(e) => setDelName(e.target.value)} aria-label="Ettevõtte nimi kinnituseks" />
        </div>
      </Dialog>
    </div>
  );
}
