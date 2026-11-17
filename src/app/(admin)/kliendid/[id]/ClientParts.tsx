"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, FormMessage, Input, type FormState } from "@/components/ui/form";
import { Switch } from "@/components/ui/pickers";
import { addNote, deleteClient, deleteNote, saveClient, setNoShowExempt, type ClientInput } from "../actions";

export function EditClientButton({ id, initial }: { id: string; initial: ClientInput }) {
  const router = useRouter();
  const [v, setV] = useState<ClientInput | null>(null);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <Button onClick={() => { setState(null); setV(initial); }}>
        <Pencil size={15} /> Muuda andmeid
      </Button>
      <Dialog
        open={!!v}
        onClose={() => setV(null)}
        title="Muuda kliendi andmeid"
        footer={
          <>
            <Button onClick={() => setV(null)}>Tühista</Button>
            <Button variant="primary" disabled={pending} onClick={() => start(async () => { const r = await saveClient(id, v!); setState(r); if (r?.ok) { setV(null); router.refresh(); } })}>
              Salvesta
            </Button>
          </>
        }
      >
        {v && (
          <div className="space-y-4">
            <FormMessage state={state} />
            <Field label="Nimi" htmlFor="eName">
              <Input id="eName" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-post" htmlFor="eEmail">
                <Input id="eEmail" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
              </Field>
              <Field label="Telefon" htmlFor="ePhone">
                <Input id="ePhone" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
              </Field>
            </div>
            <Field label="Sünnipäev" htmlFor="eBday">
              <Input id="eBday" type="date" value={v.birthday} onChange={(e) => setV({ ...v, birthday: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">SMS-meeldetuletused</span>
              <Switch checked={v.consentSms} onChange={(x) => setV({ ...v, consentSms: x })} label="SMS-meeldetuletused" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Turunduskirjad</span>
              <Switch checked={v.consentMarketing} onChange={(x) => setV({ ...v, consentMarketing: x })} label="Turunduskirjad" />
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

export function NoShowExempt({ id, exempt }: { id: string; exempt: boolean }) {
  const [opt, setOpt] = useOptimistic(exempt);
  const [, start] = useTransition();
  return <Switch checked={opt} label="Ära nõua ettemaksu" onChange={(v) => start(async () => { setOpt(v); await setNoShowExempt(id, v); })} />;
}

export function NotesCard({ id, notes }: { id: string; notes: { text: string; author: string; when: string }[] }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 p-5">
      {notes.map((n, i) => (
        <div key={i} className="group flex gap-2 border-b border-line-soft pb-3 last:border-0">
          <div className="flex-1">
            <p className="text-sm">{n.text}</p>
            <p className="mt-0.5 text-xs text-muted">
              {n.author} · {n.when}
            </p>
          </div>
          <button type="button" aria-label="Kustuta märge" onClick={() => start(() => deleteNote(id, i))} className="grid size-7 place-items-center rounded-lg text-muted opacity-0 group-hover:opacity-100 hover:bg-bad-bg hover:text-bad focus:opacity-100">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await addNote(id, text);
            setState(r?.ok ? null : r);
            if (r?.ok) setText("");
          });
        }}
        className="flex gap-2"
      >
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Lisa märge…" aria-label="Uus märge" />
        <Button type="submit" disabled={pending || !text.trim()}>
          Lisa
        </Button>
      </form>
      <FormMessage state={state} />
    </div>
  );
}

export function DeleteClientButton({ id, name }: { id: string; name: string }) {
  const [, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-bad"
      onClick={() => {
        if (confirm(`Kustutada kliendi ${name} andmed? Broneeringute ajalugu jääb raamatupidamise jaoks alles anonüümselt.`)) start(() => deleteClient(id));
      }}
    >
      <Trash2 size={15} /> Kustuta klient
    </Button>
  );
}
