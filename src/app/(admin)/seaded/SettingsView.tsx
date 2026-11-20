"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  CreditCard,
  Download,
  ShieldAlert,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useFormAction } from "@/components/ui/use-form-action";
import { Avatar } from "@/components/ui/Avatar";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
} from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import {
  Field,
  FormMessage,
  Input,
  Select,
  type FormState,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/pickers";
import {
  changePassword,
  deleteBusiness,
  saveProtection,
  updateAccount,
  connectStripe,
} from "./actions";
import { UsersCard, type PendingInvite, type SettingsUser } from "./UsersCard";

type User = SettingsUser;

const STRIPE_BADGE = {
  none: { tone: "neutral", label: "Ühendamata" },
  incomplete: { tone: "warn", label: "Pooleli" },
  review: { tone: "warn", label: "Stripe kontrollib" },
  active: { tone: "ok", label: "Ühendatud" },
} as const;

function StripeConnect({ status, available, isOwner }: { status: "none" | "incomplete" | "review" | "active"; available: boolean; isOwner: boolean }) {
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const b = STRIPE_BADGE[status];
  return (
    <div className="space-y-3 rounded-[10px] border border-line p-4">
      <div className="flex items-start gap-3">
        <CreditCard size={20} className="mt-0.5 text-muted" />
        <div className="flex-1">
          <p className="text-sm font-medium">Veebimaksed (Stripe)</p>
          <p className="text-[13px] text-muted">
            {status === "active"
              ? "Kliendid tasuvad vidinas ettemaksu kaardi, Apple Pay või Google Payga. Raha laekub otse sinu Stripe'i kontole."
              : status === "review"
                ? "Andmed on esitatud. Stripe kontrollib kontot – tavaliselt võtab see mõne minuti kuni päeva."
                : status === "incomplete"
                  ? "Stripe'i konto on loodud, kuid andmed on veel puudu. Jätka sealt, kus pooleli jäi."
                  : "Ühenda Stripe, et kliendid saaksid vidinas ettemaksu tasuda. Raha laekub otse sinu Stripe'i kontole; Aegly vahendustasu ei võta."}
          </p>
        </div>
        <Badge tone={b.tone}>{b.label}</Badge>
      </div>
      {state?.message && <p className="text-[13px] text-bad">{state.message}</p>}
      {available && isOwner && status !== "active" && (
        <Button size="sm" variant={status === "none" ? "primary" : "secondary"} disabled={pending} onClick={() => start(async () => setState(await connectStripe()))}>
          {pending ? "Suunan Stripe'i…" : status === "none" ? "Ühenda Stripe" : "Jätka Stripe'is"}
        </Button>
      )}
      {status === "active" && isOwner && (
        <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="inline-flex text-[13px] font-semibold underline">
          {"Ava Stripe'i töölaud"}
        </a>
      )}
      {!isOwner && status !== "active" && <p className="text-[13px] text-muted">Makseid saab ühendada konto omanik.</p>}
    </div>
  );
}

export function SettingsView({
  me,
  users,
  invites,
  staff,
  business,
}: {
  invites: PendingInvite[];
  staff: { id: string; name: string }[];
  me: { name: string; email: string; role: User["role"] };
  users: User[];
  business: {
    planName: string;
    planPrice: string;
    name: string;
    noShowProtection: boolean;
    noShowThreshold: number;
    stripeStatus: "none" | "incomplete" | "review" | "active";
    stripeAvailable: boolean;
    locale: string;
    currency: string;
    timezone: string;
  };
}) {
  const [name, setName] = useState(me.name);
  const [accState, setAccState] = useState<FormState>(null);
  const [pwState, onPw, pwPending] = useFormAction(changePassword);
  const [prot, setProt] = useState({
    noShowProtection: business.noShowProtection,
    noShowThreshold: business.noShowThreshold,
  });
  const [protState, setProtState] = useState<FormState>(null);
  const [delOpen, setDelOpen] = useState(false);
  const [delName, setDelName] = useState("");
  const [delState, setDelState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const owner = me.role === "OWNER";
  const manager = me.role !== "STAFF";

  const saveProt = (next: typeof prot) => {
    setProt(next);
    start(async () => setProtState(await saveProtection(next)));
  };

  return (
    <div className="max-w-[920px] space-y-5">
      <PageHeader
        title="Seaded"
        subtitle="Konto, kasutajad, maksed ja andmed."
      />

      {owner && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-[15px] font-semibold">Pakett ja arveldus</h2>
            <p className="mt-0.5 text-[13px] text-muted">
              Praegune pakett: <b className="text-ink">{business.planName}</b> ·{" "}
              {business.planPrice}
            </p>
          </div>
          <Link
            href="/seaded/pakett"
            className="inline-flex h-9 items-center rounded-[10px] border border-line px-3 text-sm font-semibold hover:bg-line-soft"
          >
            Halda paketti
          </Link>
        </Card>
      )}

      <Card>
        <CardHeader title="Minu konto" />
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
          <div className="space-y-3">
            <Field label="Nimi" htmlFor="sName">
              <Input
                id="sName"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="E-post" htmlFor="sEmail" hint="Sisselogimise e-post">
              <Input id="sEmail" value={me.email} disabled />
            </Field>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                disabled={pending || name === me.name}
                onClick={() =>
                  start(async () => setAccState(await updateAccount({ name })))
                }
              >
                Salvesta nimi
              </Button>
              <FormMessage state={accState} />
            </div>
          </div>
          <form onSubmit={onPw} className="space-y-3">
            <Field
              label="Praegune parool"
              htmlFor="pwCur"
              error={pwState?.errors?.current}
            >
              <Input
                id="pwCur"
                name="current"
                type="password"
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="Uus parool"
              htmlFor="pwNew"
              hint="Vähemalt 8 märki"
              error={pwState?.errors?.next}
            >
              <Input
                id="pwNew"
                name="next"
                type="password"
                autoComplete="new-password"
              />
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

      {manager && (
        <UsersCard me={me} users={users} invites={invites} staff={staff} />
      )}

      {manager && (
        <Card>
          <CardHeader title="Maksed ja kaitse" />
          <div className="space-y-5 p-5">
            <StripeConnect status={business.stripeStatus} available={business.stripeAvailable} isOwner={owner} />
            <div className="flex items-start justify-between gap-4">
              <span className="flex gap-3">
                <ShieldAlert size={20} className="mt-0.5 text-muted" />
                <span>
                  <span className="block text-sm font-medium">
                    Mitteilmumise kaitse
                  </span>
                  <span className="text-[13px] text-muted">
                    Kliendilt, kes on korduvalt ilmumata jätnud, nõutakse
                    vidinas 100% ettemaksu.
                  </span>
                </span>
              </span>
              <Switch
                checked={prot.noShowProtection}
                onChange={(x) => saveProt({ ...prot, noShowProtection: x })}
                label="Mitteilmumise kaitse"
              />
            </div>
            <Field label="Rakendub alates" htmlFor="sThreshold">
              <Select
                id="sThreshold"
                className="max-w-[320px]"
                disabled={!prot.noShowProtection}
                value={prot.noShowThreshold}
                onChange={(e) =>
                  saveProt({ ...prot, noShowThreshold: Number(e.target.value) })
                }
              >
                {[1, 2, 3, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} mitteilmumisest 12 kuu jooksul
                  </option>
                ))}
              </Select>
            </Field>
            <FormMessage state={protState?.ok ? null : protState} />
            <p className="text-[13px] text-muted">
              Ettemaksu protsent määratakse iga teenuse juures (
              <Link href="/teenused" className="underline">
                Teenused
              </Link>
              ), tühistamise ja broneerimise reeglid lehel{" "}
              <Link href="/tooajad" className="underline">
                Tööajad ja vabad ajad
              </Link>
              .
            </p>
          </div>
        </Card>
      )}

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
              {business.timezone} ·{" "}
              <Link href="/profiil" className="text-[13px] underline">
                muuda
              </Link>
            </dd>
          </div>
        </dl>
      </Card>

      {manager && (
        <Card>
          <CardHeader
            title="Andmed ja privaatsus"
            subtitle="Sina oled oma klientide andmete vastutav töötleja, Aegly on volitatud töötleja."
          />
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div className="flex flex-wrap gap-2">
              <a
                href="/kliendid/export"
                download
                className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border border-line px-2.5 text-[13px] font-semibold hover:bg-[#f9fafb]"
              >
                <Download size={15} /> Kliendid (CSV)
              </a>
              <a
                href="/hinnakiri/export"
                download
                className="inline-flex h-[34px] items-center gap-1.5 rounded-[10px] border border-line px-2.5 text-[13px] font-semibold hover:bg-[#f9fafb]"
              >
                <Download size={15} /> Hinnakiri (CSV)
              </a>
            </div>
            {owner && (
              <Button
                size="sm"
                variant="ghost"
                className="text-bad"
                onClick={() => {
                  setDelName("");
                  setDelState(null);
                  setDelOpen(true);
                }}
              >
                <Trash2 size={15} /> Kustuta konto
              </Button>
            )}
          </div>
        </Card>
      )}

      <Dialog
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Kustuta konto"
        subtitle="Kõik andmed – broneeringud, kliendid, teenused, töötajad – kustutatakse jäädavalt."
        footer={
          <>
            <Button onClick={() => setDelOpen(false)}>Tühista</Button>
            <Button
              className="border-danger bg-danger text-white hover:bg-[#d92d20]"
              disabled={pending || delName !== business.name}
              onClick={() =>
                start(async () => setDelState(await deleteBusiness(delName)))
              }
            >
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
          <Input
            value={delName}
            onChange={(e) => setDelName(e.target.value)}
            aria-label="Ettevõtte nimi kinnituseks"
          />
        </div>
      </Dialog>
    </div>
  );
}
