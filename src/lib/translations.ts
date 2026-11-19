/**
 * Salongi sisestatud tekstide tõlked (teenused, kategooriad, kampaaniad, töötaja ametikoht, salongi kirjeldus).
 * Põhitekst on eesti keeles; tõlge on valikuline – puudumisel näeb klient eestikeelset teksti.
 */
export const TR_LANGS = [
  { id: "en", label: "Inglise" },
  { id: "ru", label: "Vene" },
] as const;
export type TrLang = (typeof TR_LANGS)[number]["id"];
export type Translations = Partial<Record<TrLang, Record<string, string>>>;

const MAX = 600;

/** Vormist (väljad nimega tr.en.name jne) → puhastatud tõlked */
export function readTranslations(fd: FormData, fields: string[]): Translations {
  const out: Translations = {};
  for (const { id } of TR_LANGS) {
    for (const f of fields) {
      const v = String(fd.get(`tr.${id}.${f}`) ?? "").trim().slice(0, MAX);
      if (v) (out[id] ??= {})[f] = v;
    }
  }
  return out;
}

/** Kliendilt tulnud objekt → puhastatud tõlked (ainult lubatud keeled ja väljad) */
export function cleanTranslations(raw: unknown, fields: string[]): Translations {
  const out: Translations = {};
  if (!raw || typeof raw !== "object") return out;
  for (const { id } of TR_LANGS) {
    const src = (raw as Record<string, unknown>)[id];
    if (!src || typeof src !== "object") continue;
    for (const f of fields) {
      const v = String((src as Record<string, unknown>)[f] ?? "").trim().slice(0, MAX);
      if (v) (out[id] ??= {})[f] = v;
    }
  }
  return out;
}

/** Tekst valitud keeles (puudumisel põhitekst) */
export function loc(base: string, translations: Translations | null | undefined, lang: string, field: string): string;
export function loc(base: string | null, translations: Translations | null | undefined, lang: string, field: string): string | null;
export function loc(base: string | null, translations: Translations | null | undefined, lang: string, field: string): string | null {
  if (lang === "et") return base;
  return translations?.[lang as TrLang]?.[field] || base;
}
