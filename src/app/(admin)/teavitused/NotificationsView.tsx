"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Mail, MessageSquare } from "lucide-react";
import { clsx } from "clsx";
import Link from "next/link";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, Textarea, type FormState } from "@/components/ui/form";
import { Segmented, Switch } from "@/components/ui/pickers";
import { NOTIFICATIONS, VARIABLES, renderTemplate, smsSegments } from "@/lib/notifications";
import { saveNotifications, type NotificationsInput } from "./actions";

type Item = NotificationsInput["items"][number];

export function NotificationsView({ initial, sample, delivery }: { initial: NotificationsInput; sample: Record<string, string>; delivery: { email: boolean; sms: boolean } }) {
  const [v, setV] = useState(initial);
  const [selected, setSelected] = useState<Item["type"]>("REMINDER");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const item = v.items.find((i) => i.type === selected)!;
  const meta = NOTIFICATIONS.find((n) => n.type === selected)!;
  const setItem = (patch: Partial<Item>) => setV((p) => ({ ...p, items: p.items.map((i) => (i.type === selected ? { ...i, ...patch } : i)) }));
  const setTop = <K extends keyof NotificationsInput>(k: K, val: NotificationsInput[K]) => setV((p) => ({ ...p, [k]: val }));

  const insertVar = (variable: string) => {
    const el = bodyRef.current;
    const key = channel === "sms" ? "smsBody" : "emailBody";
    const text = item[key];
    const pos = el?.selectionStart ?? text.length;
    setItem({ [key]: text.slice(0, pos) + variable + text.slice(el?.selectionEnd ?? pos) } as Partial<Item>);
    requestAnimationFrame(() => el?.focus());
  };

  const seg = smsSegments(renderTemplate(item.smsBody, sample));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Teavitused"
        subtitle="Automaatsed e-kirjad ja SMS-id klientidele. Mallid kasutavad broneeringu andmeid."
        actions={
          <>
          <Link href="/teavitused/saadetud" className="inline-flex h-10 items-center rounded-[10px] border border-line bg-white px-3.5 text-sm font-semibold hover:bg-[#f9fafb]">
            Saadetud
          </Link>
          <Button variant="primary" disabled={pending} onClick={() => start(async () => setState(await saveNotifications(v)))}>
            <Check size={16} strokeWidth={2.5} /> Salvesta
          </Button>
          </>
        }
      />
      <FormMessage state={state} />
      {(!delivery.email || !delivery.sms) && (
        <p className="rounded-[10px] border border-warn/30 bg-warn-bg px-4 py-3 text-[13px] text-warn">
          {!delivery.email && "E-post on arendusrežiimis: kirjad salvestatakse lehele „Saadetud“, aga klientidele neid veel ei saadeta. "}
          {!delivery.sms && "SMS-teenus pole ühendatud: SMS-e ei saadeta ja vidinas SMS-meeldetuletuse valikut ei näidata."}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Saatja" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Field label="Saatja nimi (e-post)" htmlFor="nSender">
                <Input id="nSender" value={v.emailSenderName} onChange={(e) => setTop("emailSenderName", e.target.value)} />
              </Field>
              <Field label="SMS saatja" htmlFor="nSms" hint="Kuni 11 tähemärki, ilma täpitähtedeta">
                <Input id="nSms" value={v.smsSender} maxLength={11} onChange={(e) => setTop("smsSender", e.target.value)} />
              </Field>
              <Field label="Vastuste e-post" htmlFor="nReply">
                <Input id="nReply" type="email" value={v.replyToEmail} onChange={(e) => setTop("replyToEmail", e.target.value)} />
              </Field>
              <Field label="Google arvustuse link" htmlFor="nReview">
                <Input id="nReview" value={v.googleReviewUrl} onChange={(e) => setTop("googleReviewUrl", e.target.value)} placeholder="https://g.page/r/…" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Automaatsed teavitused" subtitle="Lülita sisse ja vali kanal" />
            <ul className="divide-y divide-line-soft">
              {NOTIFICATIONS.map((n) => {
                const it = v.items.find((i) => i.type === n.type)!;
                const opt = n.offsetOptions?.find((o) => o.value === it.offsetMinutes);
                return (
                  <li key={n.type} className={clsx("flex flex-wrap items-center gap-4 px-5 py-3.5", selected === n.type && "bg-lime-soft/50")}>
                    <button type="button" onClick={() => setSelected(n.type)} className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted">{opt ? `${opt.label} ${n.timing}` : n.timing}</p>
                    </button>
                    <label className="flex items-center gap-2 text-[13px]">
                      <Mail size={15} className="text-muted" /> E-post
                      <Switch checked={it.emailEnabled} onChange={(x) => setV((p) => ({ ...p, items: p.items.map((i) => (i.type === n.type ? { ...i, emailEnabled: x } : i)) }))} label={`${n.title}: e-post`} />
                    </label>
                    <label className="flex items-center gap-2 text-[13px]">
                      <MessageSquare size={15} className="text-muted" /> SMS
                      <Switch checked={it.smsEnabled} onChange={(x) => setV((p) => ({ ...p, items: p.items.map((i) => (i.type === n.type ? { ...i, smsEnabled: x } : i)) }))} label={`${n.title}: SMS`} />
                    </label>
                    <Button size="sm" variant={selected === n.type ? "primary" : "secondary"} onClick={() => setSelected(n.type)}>
                      Mall
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title={`Mall: ${meta.title}`} />
            <div className="space-y-4 p-5">
              <Segmented value={channel} onChange={setChannel} options={[{ value: "sms", label: "SMS" }, { value: "email", label: "E-post" }]} />
              {meta.offsetOptions && (
                <Field label="Saatmise aeg" htmlFor="nOffset">
                  <Select id="nOffset" value={item.offsetMinutes ?? meta.offsetMinutes ?? ""} onChange={(e) => setItem({ offsetMinutes: Number(e.target.value) })}>
                    {meta.offsetOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label} {meta.timing}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              {channel === "email" && (
                <Field label="Teema" htmlFor="nSubject">
                  <Input id="nSubject" value={item.emailSubject} onChange={(e) => setItem({ emailSubject: e.target.value })} />
                </Field>
              )}
              <Field label="Sõnum" htmlFor="nBody">
                <Textarea
                  id="nBody"
                  ref={bodyRef}
                  rows={channel === "sms" ? 4 : 9}
                  value={channel === "sms" ? item.smsBody : item.emailBody}
                  onChange={(e) => setItem(channel === "sms" ? { smsBody: e.target.value } : { emailBody: e.target.value })}
                />
              </Field>
              <div>
                <p className="mb-1.5 text-[13px] font-medium">Muutujad</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map((x) => (
                    <button key={x} type="button" onClick={() => insertVar(x)} className="rounded-md bg-line-soft px-2 py-1 font-mono text-xs hover:bg-line">
                      {x}
                    </button>
                  ))}
                </div>
              </div>
              {channel === "sms" && (
                <p className={clsx("text-xs", seg.segments > 1 ? "text-warn" : "text-muted")}>
                  {seg.chars} / {seg.perSegment} tähemärki · {seg.segments} SMS{seg.unicode ? " · täpitähed vähendavad pikkust 70 märgini" : ""}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Eelvaade" subtitle="Näidisandmetega" />
            <div className="p-5">
              {channel === "sms" ? (
                <div className="rounded-[18px] bg-[#f2f4f7] p-4">
                  <p className="mb-2 text-center text-xs font-semibold text-muted">{v.smsSender || "Saatja"} · SMS</p>
                  <p className="max-w-[90%] rounded-[16px] rounded-bl-sm bg-white px-3 py-2 text-sm whitespace-pre-wrap shadow-sm">{renderTemplate(item.smsBody, sample)}</p>
                </div>
              ) : (
                <div className="rounded-[12px] border border-line">
                  <div className="border-b border-line-soft px-4 py-2.5 text-xs text-muted">
                    <p>
                      Saatja: <span className="text-ink">{v.emailSenderName || sample["{salong}"]}</span>
                    </p>
                    <p>
                      Teema: <span className="font-semibold text-ink">{renderTemplate(item.emailSubject, sample)}</span>
                    </p>
                  </div>
                  <p className="px-4 py-3 text-sm whitespace-pre-wrap">{renderTemplate(item.emailBody, sample)}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
