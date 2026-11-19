"use client";

import { useFormAction } from "@/components/ui/use-form-action";

import { Check } from "lucide-react";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Textarea, Toggle } from "@/components/ui/form";
import { saveProfile } from "./actions";
import { ImageField } from "@/components/ui/ImageField";

const COLORS = ["#f04438", "#7a5af8", "#0ba5ec", "#12b76a", "#f79009", "#ee46bc", "#6172f3", "#15b79e"];

export type ProfileValues = {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  color: string;
  avatarUrl: string | null;
  bio: string | null;
  bookableOnline: boolean;
  active: boolean;
};

export function ProfileForm({ staffId, values }: { staffId: string | null; values: ProfileValues }) {
  const [state, action, pending] = useFormAction(saveProfile.bind(null, staffId));
  const e = state?.errors ?? {};
  return (
    <form onSubmit={action}>
      <Card>
        <CardHeader title="Profiil" subtitle="Nimi, ametikoht ja kirjeldus kuvatakse vidinas spetsialisti valikul." />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <FormMessage state={state} />
          <span className="hidden sm:block" />
          <div className="sm:col-span-2">
            <ImageField name="avatar" currentUrl={values.avatarUrl} width={256} height={256} round label="Profiilipilt" hint="Kuvatakse vidinas spetsialisti valikul · JPG, PNG või HEIC" />
            {e.avatar && <p className="mt-1 text-xs text-bad">{e.avatar[0]}</p>}
          </div>
          <Field label="Nimi" htmlFor="name" error={e.name}>
            <Input id="name" name="name" defaultValue={values.name} aria-invalid={!!e.name} />
          </Field>
          <Field label="Ametikoht" htmlFor="title" error={e.title}>
            <Input id="title" name="title" defaultValue={values.title ?? ""} placeholder="nt Massöör" />
          </Field>
          <Field label="E-post" htmlFor="email" hint="Kasutatakse teavitusteks ja sisselogimise kutseks" error={e.email}>
            <Input id="email" name="email" type="email" defaultValue={values.email ?? ""} aria-invalid={!!e.email} />
          </Field>
          <Field label="Telefon" htmlFor="phone" error={e.phone}>
            <Input id="phone" name="phone" defaultValue={values.phone ?? ""} placeholder="+372" />
          </Field>
          <Field label="Kirjeldus" htmlFor="bio" className="sm:col-span-2">
            <Textarea id="bio" name="bio" rows={3} defaultValue={values.bio ?? ""} placeholder="Lühitutvustus kliendile" />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-[13px] font-medium">Värv kalendris</legend>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <label key={c} className="cursor-pointer">
                  <input type="radio" name="color" value={c} defaultChecked={values.color === c} className="peer sr-only" />
                  <span className="block size-8 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-lime" style={{ background: c }} aria-label={c} />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-4 sm:col-span-2">
            <Toggle name="bookableOnline" label="Online broneeritav" description="Klient saab vidinas seda töötajat valida" defaultChecked={values.bookableOnline} />
            {staffId && <Toggle name="active" label="Aktiivne" description="Mitteaktiivne töötaja ei ilmu kalendrisse ega vidinasse" defaultChecked={values.active} />}
          </div>
        </div>
        <div className="flex justify-end border-t border-line-soft px-5 py-4">
          <Button type="submit" variant="primary" disabled={pending}>
            <Check size={16} strokeWidth={2.5} />
            {staffId ? "Salvesta" : "Lisa töötaja"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
