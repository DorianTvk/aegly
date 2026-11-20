"use client";

import { TranslationFields } from "@/components/ui/TranslationFields";
import type { Translations } from "@/lib/translations";
import { useState } from "react";
import { Check, ImageIcon, MapPin, Upload } from "lucide-react";
import { useFormAction } from "@/components/ui/use-form-action";
import { Button, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui/primitives";
import { Field, FormMessage, Input, Select, Textarea, Toggle } from "@/components/ui/form";
import { saveBusinessProfile } from "./actions";

export type ProfileValues = {
  name: string; registryCode: string | null; vatNumber: string | null; industry: string | null; timezone: string;
  description: string | null; translations: Translations; address: string | null; phone: string | null; email: string | null; website: string | null;
  instagram: string | null; facebook: string | null; logoUrl: string | null; bannerUrl: string | null;
  widgetShowBanner: boolean; logoInEmails: boolean; widgetPrimary: string; todayHours: string;
};

function ImageField({ name, label, hint, url, square }: { name: string; label: string; hint: string; url: string | null; square?: boolean }) {
  const [preview, setPreview] = useState<string | null>(url);
  const [removed, setRemoved] = useState(false);
  return (
    <div className="flex items-center gap-4">
      <div className={`grid shrink-0 place-items-center overflow-hidden rounded-[10px] border border-line bg-line-soft ${square ? "size-16" : "h-16 w-40"}`}>
        {preview && !removed ? (
          // eslint-disable-next-line @next/next/no-img-element -- kasutaja üles laaditud fail, mõõdud teadmata
          <img src={preview} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon size={20} className="text-subtle" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <label className="inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-line bg-white px-2.5 text-[13px] font-semibold hover:bg-[#f9fafb]">
        <Upload size={15} /> {preview && !removed ? "Vaheta" : "Laadi üles"}
        <input
          type="file"
          name={name}
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setPreview(URL.createObjectURL(f)); setRemoved(false); }
          }}
        />
      </label>
      {preview && !removed && (
        <button type="button" onClick={() => setRemoved(true)} className="text-[13px] font-semibold text-muted hover:text-bad">
          Eemalda
        </button>
      )}
      {removed && <input type="hidden" name={name === "logo" ? "removeLogo" : "removeBanner"} value="1" />}
    </div>
  );
}

export function ProfileForm({ v }: { v: ProfileValues }) {
  const [state, onSubmit, pending] = useFormAction(saveBusinessProfile);
  const e = state?.errors ?? {};
  const [name, setName] = useState(v.name);
  const [address, setAddress] = useState(v.address ?? "");

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <PageHeader
        title="Ettevõtte profiil"
        subtitle="Neid andmeid ja pilte kasutatakse broneerimisvidinas, kinnituskirjades ja arvetel."
        actions={
          <Button type="submit" variant="primary" disabled={pending}>
            <Check size={16} strokeWidth={2.5} /> {pending ? "Salvestan…" : "Salvesta"}
          </Button>
        }
      />
      <FormMessage state={state} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Logo ja bänner" subtitle="Kasutatakse broneerimisvidinas, kinnituskirjades ja kliendi lingis" />
            <div className="space-y-4 p-5">
              <ImageField name="logo" label="Logo" hint="Ruudukujuline, vähemalt 400×400 px · PNG, SVG, JPG · kuni 2 MB" url={v.logoUrl} square />
              {e.logo && <p className="text-xs text-bad">{e.logo[0]}</p>}
              <ImageField name="banner" label="Bänneripilt" hint="Soovitatav 1600×500 px · JPG, PNG või WebP · kuni 2 MB" url={v.bannerUrl} />
              {e.banner && <p className="text-xs text-bad">{e.banner[0]}</p>}
              <Toggle name="widgetShowBanner" label="Kuva bänner broneerimisvidinas" description="Bänner ja logo kuvatakse vidina päises" defaultChecked={v.widgetShowBanner} />
              <Toggle name="logoInEmails" label="Kasuta logo kinnituskirjades ja SMS-lingis" defaultChecked={v.logoInEmails} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Põhiandmed" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Field label="Ettevõtte nimi" htmlFor="name" error={e.name}>
                <Input id="name" name="name" value={name} onChange={(ev) => setName(ev.target.value)} />
              </Field>
              <Field label="Registrikood" htmlFor="registryCode">
                <Input id="registryCode" name="registryCode" defaultValue={v.registryCode ?? ""} />
              </Field>
              <Field label="KMKR number" htmlFor="vatNumber">
                <Input id="vatNumber" name="vatNumber" defaultValue={v.vatNumber ?? ""} placeholder="EE…" />
              </Field>
              <Field label="Tegevusala" htmlFor="industry">
                <Input id="industry" name="industry" defaultValue={v.industry ?? ""} placeholder="nt Massaaž ja spaa" />
              </Field>
              <Field label="Ajavöönd" htmlFor="timezone">
                <Select id="timezone" name="timezone" defaultValue={v.timezone}>
                  <option value="Europe/Tallinn">Europe/Tallinn</option>
                  <option value="Europe/Riga">Europe/Riga</option>
                  <option value="Europe/Vilnius">Europe/Vilnius</option>
                  <option value="Europe/Helsinki">Europe/Helsinki</option>
                </Select>
              </Field>
              <Field label="Lühikirjeldus (kuvatakse vidinas)" htmlFor="description" className="sm:col-span-2">
                <Textarea id="description" name="description" rows={3} defaultValue={v.description ?? ""} maxLength={400} />
              </Field>
              <TranslationFields className="sm:col-span-2" value={v.translations} fields={[{ key: "description", label: "Lühikirjeldus", multiline: true, maxLength: 400 }]} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Kontakt ja asukoht" />
            <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
              <Field label="Aadress" htmlFor="address" className="sm:col-span-2">
                <Input id="address" name="address" value={address} onChange={(ev) => setAddress(ev.target.value)} />
              </Field>
              <Field label="Telefon" htmlFor="phone">
                <Input id="phone" name="phone" defaultValue={v.phone ?? ""} />
              </Field>
              <Field label="E-post" htmlFor="email" error={e.email}>
                <Input id="email" name="email" type="email" defaultValue={v.email ?? ""} />
              </Field>
              <Field label="Koduleht" htmlFor="website">
                <Input id="website" name="website" defaultValue={v.website ?? ""} placeholder="studiolumi.ee" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Eelvaade vidinas" subtitle="Nii näeb klient päist broneerimisel" />
            <div className="p-5">
              <div className="overflow-hidden rounded-[12px] border border-line">
                <div className="relative h-24" style={{ background: v.bannerUrl ? `center/cover url(${v.bannerUrl})` : `linear-gradient(135deg, ${v.widgetPrimary}, #0b4f4a)` }} />
                <div className="relative px-4 pb-4">
                  <div className="-mt-7 grid size-14 place-items-center overflow-hidden rounded-[12px] border-2 border-white bg-white text-lg font-bold shadow" style={{ color: v.widgetPrimary }}>
                    {v.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- kasutaja logo
                      <img src={v.logoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      name.slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <p className="mt-2 font-semibold">{name || "Ettevõtte nimi"}</p>
                  <p className="flex items-center gap-1 text-xs text-muted">
                    <MapPin size={12} /> {address || "Aadress"} · {v.todayHours}
                  </p>
                </div>
              </div>
              <LinkButton href="/vidin" size="sm" className="mt-3 w-full">
                Ava vidina seaded
              </LinkButton>
            </div>
          </Card>
          <Card>
            <CardHeader title="Sotsiaalmeedia" />
            <div className="space-y-4 p-5">
              <Field label="Instagram" htmlFor="instagram">
                <Input id="instagram" name="instagram" defaultValue={v.instagram ?? ""} placeholder="instagram.com/…" />
              </Field>
              <Field label="Facebook" htmlFor="facebook">
                <Input id="facebook" name="facebook" defaultValue={v.facebook ?? ""} placeholder="facebook.com/…" />
              </Field>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
