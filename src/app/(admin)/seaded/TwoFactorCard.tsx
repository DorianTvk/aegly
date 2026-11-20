"use client";

import { useState, useTransition } from "react";
import { Copy, Download, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui/primitives";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/form";
import { confirmTwoFactor, disableTwoFactor, newRecoveryCodes, signOutOtherDevices, startTwoFactor, type TwoFactorResult } from "./two-factor-actions";

function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Salvesta need <b>varukoodid</b> turvalisse kohta (nt paroolihaldurisse). Kui telefon kaob, saad nendega sisse logida – iga koodi ühe korra.
        Neid näidatakse ainult praegu.
      </p>
      <ul className="grid grid-cols-2 gap-2 rounded-[10px] border border-line bg-line-soft/60 p-4 font-mono text-[15px]">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => navigator.clipboard.writeText(text)}>
          <Copy size={14} aria-hidden /> Kopeeri
        </Button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Aegly varukoodid\n\n${text}\n`)}`}
          download="aegly-varukoodid.txt"
          className="inline-flex h-8 items-center gap-1.5 rounded-[9px] border border-line bg-white px-3 text-[13px] font-semibold hover:bg-line-soft"
        >
          <Download size={14} aria-hidden /> Laadi alla
        </a>
      </div>
    </div>
  );
}

export function TwoFactorCard({ enabled, recoveryLeft, required, otherSessions }: { enabled: boolean; recoveryLeft: number; required: boolean; otherSessions: number }) {
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<TwoFactorResult | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [sessMsg, setSessMsg] = useState<string | null>(null);

  const closeAll = () => { setSetup(null); setCodes(null); setCode(""); setMsg(null); setDisableOpen(false); setRegenOpen(false); setPw(""); };

  return (
    <Card id="turvalisus">
      <CardHeader
        title="Kaheastmeline sisselogimine"
        subtitle="Lisaks paroolile küsitakse sisselogimisel telefoni autentimisrakenduse koodi. Isegi kui keegi su parooli teada saab, ei pääse ta kontole."
        action={enabled ? <Badge tone="ok">Sees</Badge> : <Badge tone={required ? "bad" : "neutral"}>{required ? "Nõutud" : "Väljas"}</Badge>}
      />
      <div className="space-y-4 p-5">
        {required && !enabled && (
          <p className="rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
            Platvormi halduri kontol on kaheastmeline sisselogimine kohustuslik. Platvormi vaade avaneb pärast selle sisselülitamist.
          </p>
        )}
        {enabled ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex-1 text-sm text-muted">
              <ShieldCheck size={16} className="mr-1 inline text-ok" aria-hidden />
              Konto on kaitstud. Kasutamata varukoode: <b className="text-ink">{recoveryLeft}</b>
              {recoveryLeft <= 3 && " – loo uued, enne kui need otsa saavad."}
            </p>
            <Button size="sm" onClick={() => setRegenOpen(true)}>
              <KeyRound size={14} aria-hidden /> Uued varukoodid
            </Button>
            <Button size="sm" onClick={() => setDisableOpen(true)}>
              Lülita välja
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() => start(async () => { const r = await startTwoFactor(); if (r.ok) setSetup(r); else setMsg(r.message ?? null); })}
          >
            <ShieldCheck size={14} aria-hidden /> {pending ? "Valmistan ette…" : "Lülita sisse"}
          </Button>
        )}
        {msg && !setup && <p className="text-[13px] text-bad">{msg}</p>}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <p className="flex-1 text-sm text-muted">
            {otherSessions === 0 ? "Oled sisse logitud ainult selles seadmes." : `Oled sisse logitud veel ${otherSessions} $seadmes.`}
          </p>
          {otherSessions > 0 && (
            <Button size="sm" disabled={pending} onClick={() => start(async () => setSessMsg((await signOutOtherDevices()).message ?? null))}>
              <LogOut size={14} aria-hidden /> Logi teised seadmed välja
            </Button>
          )}
          {sessMsg && <p className="w-full text-[13px] text-ok">{sessMsg}</p>}
        </div>
      </div>

      {/* Sisselülitamine: QR → kood → varukoodid */}
      <Dialog
        open={!!setup}
        onClose={closeAll}
        title={codes ? "Kaheastmeline sisselogimine on sees" : "Lülita sisse kaheastmeline sisselogimine"}
        footer={
          codes ? (
            <Button variant="primary" onClick={() => { closeAll(); location.reload(); }}>Salvestasin koodid</Button>
          ) : (
            <>
              <Button onClick={closeAll}>Tühista</Button>
              <Button
                variant="primary"
                disabled={pending || code.replace(/\s/g, "").length !== 6}
                onClick={() => start(async () => { const r = await confirmTwoFactor(code); if (r.ok && r.codes) { setCodes(r.codes); setMsg(null); } else setMsg(r.message ?? "Viga"); })}
              >
                {pending ? "Kontrollin…" : "Kinnita"}
              </Button>
            </>
          )
        }
      >
        {codes ? (
          <RecoveryCodes codes={codes} />
        ) : (
          setup && (
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Paigalda telefoni autentimisrakendus, nt <b>Google Authenticator</b>, <b>Microsoft Authenticator</b> või kasuta paroolihaldurit (1Password, Bitwarden).</li>
                <li>Skanni rakendusega see QR-kood.</li>
                <li>Sisesta rakenduses näha olev 6-kohaline kood.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-5">
                <div className="size-[180px] shrink-0 rounded-[10px] border border-line bg-white p-2 [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: setup.qr ?? "" }} />
                <div className="min-w-0 flex-1 space-y-1 text-[13px] text-muted">
                  <p>Ei saa skannida? Sisesta rakendusse see võti käsitsi:</p>
                  <p className="font-mono text-[13px] break-all text-ink select-all">{setup.secret?.match(/.{1,4}/g)?.join(" ")}</p>
                </div>
              </div>
              <Field label="Kood rakendusest" htmlFor="tfaCode" error={msg ? [msg] : undefined}>
                <Input
                  id="tfaCode" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)}
                  className="max-w-[200px] text-center font-mono text-lg tracking-[0.3em]" placeholder="000000"
                />
              </Field>
            </div>
          )
        )}
      </Dialog>

      {/* Välja lülitamine */}
      <Dialog
        open={disableOpen}
        onClose={closeAll}
        title="Lülita kaheastmeline sisselogimine välja?"
        subtitle="Pärast seda piisab sisselogimiseks ainult paroolist."
        footer={
          <>
            <Button onClick={closeAll}>Tühista</Button>
            <Button
              className="border-bad text-bad hover:bg-bad-bg"
              disabled={pending || !pw || !code}
              onClick={() => start(async () => { const r = await disableTwoFactor({ password: pw, code }); if (r.ok) { closeAll(); location.reload(); } else setMsg(r.message ?? "Viga"); })}
            >
              Lülita välja
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Parool" htmlFor="tfaPw">
            <Input id="tfaPw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Kood rakendusest või varukood" htmlFor="tfaOff" error={msg ? [msg] : undefined}>
            <Input id="tfaOff" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        </div>
      </Dialog>

      {/* Uued varukoodid */}
      <Dialog
        open={regenOpen}
        onClose={closeAll}
        title="Uued varukoodid"
        subtitle={codes ? undefined : "Vanad varukoodid kaotavad kehtivuse."}
        footer={
          codes ? (
            <Button variant="primary" onClick={() => { closeAll(); location.reload(); }}>Salvestasin koodid</Button>
          ) : (
            <>
              <Button onClick={closeAll}>Tühista</Button>
              <Button
                variant="primary"
                disabled={pending || code.replace(/\s/g, "").length !== 6}
                onClick={() => start(async () => { const r = await newRecoveryCodes(code); if (r.ok && r.codes) { setCodes(r.codes); setMsg(null); } else setMsg(r.message ?? "Viga"); })}
              >
                Loo uued
              </Button>
            </>
          )
        }
      >
        {codes ? (
          <RecoveryCodes codes={codes} />
        ) : (
          <Field label="Kood rakendusest" htmlFor="tfaRegen" error={msg ? [msg] : undefined}>
            <Input id="tfaRegen" inputMode="numeric" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} className="max-w-[200px] text-center font-mono text-lg tracking-[0.3em]" />
          </Field>
        )}
      </Dialog>
    </Card>
  );
}
