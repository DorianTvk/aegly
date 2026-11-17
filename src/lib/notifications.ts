/**
 * Teavituste tüübid, vaikeväärtused ja mallide täitmine.
 * Puhas loogika – kasutatakse nii seadete vaates kui (hiljem) saatmisel.
 */

export type NotificationType = "CONFIRMATION" | "REMINDER" | "CHANGED" | "CANCELLED" | "PAYMENT_PENDING" | "WAITLIST" | "REVIEW" | "BIRTHDAY";

export type NotificationDefaults = {
  type: NotificationType;
  title: string;
  timing: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  offsetMinutes: number | null;
  /** kas aega saab muuta ja mis valikutega */
  offsetOptions?: { value: number; label: string }[];
  emailSubject: string;
  emailBody: string;
  smsBody: string;
};

export const VARIABLES = ["{eesnimi}", "{teenus}", "{kuupäev}", "{kellaaeg}", "{töötaja}", "{link}", "{aadress}", "{salong}"] as const;

export const NOTIFICATIONS: NotificationDefaults[] = [
  {
    type: "CONFIRMATION", title: "Broneeringu kinnitus", timing: "Kohe pärast broneerimist", emailEnabled: true, smsEnabled: false, offsetMinutes: null,
    emailSubject: "Broneering kinnitatud – {teenus} {kuupäev} kell {kellaaeg}",
    emailBody: "Tere {eesnimi}!\n\nSinu aeg on broneeritud:\n{teenus} · {töötaja}\n{kuupäev} kell {kellaaeg}\n{aadress}\n\nMuuda või tühista: {link}\n\nKohtumiseni!\n{salong}",
    smsBody: "{salong}: {teenus} {kuupäev} kell {kellaaeg} on kinnitatud. Muuda: {link}",
  },
  {
    type: "REMINDER", title: "Meeldetuletus", timing: "enne algust", emailEnabled: true, smsEnabled: true, offsetMinutes: 1440,
    offsetOptions: [{ value: 120, label: "2 h" }, { value: 1440, label: "24 h" }, { value: 2880, label: "48 h" }],
    emailSubject: "Meeldetuletus: {teenus} {kuupäev} kell {kellaaeg}",
    emailBody: "Tere {eesnimi}!\n\nTuletame meelde sinu aega:\n{teenus} · {töötaja}\n{kuupäev} kell {kellaaeg}\n{aadress}\n\nKui sa ei saa tulla, tühista: {link}\n\n{salong}",
    smsBody: "Tere {eesnimi}! Meeldetuletus: {teenus} {kuupäev} kell {kellaaeg}, {aadress}. Muuda või tühista: {link}",
  },
  {
    type: "CHANGED", title: "Muudatus", timing: "Kohe, kui aeg muutub", emailEnabled: true, smsEnabled: true, offsetMinutes: null,
    emailSubject: "Sinu broneering muutus – {kuupäev} kell {kellaaeg}",
    emailBody: "Tere {eesnimi}!\n\nSinu broneeringu uus aeg:\n{teenus} · {töötaja}\n{kuupäev} kell {kellaaeg}\n\nVaata: {link}\n\n{salong}",
    smsBody: "{salong}: sinu aeg muutus – {teenus} {kuupäev} kell {kellaaeg}. {link}",
  },
  {
    type: "CANCELLED", title: "Tühistamine", timing: "Kohe · koos tagastuse infoga", emailEnabled: true, smsEnabled: false, offsetMinutes: null,
    emailSubject: "Broneering tühistatud – {teenus} {kuupäev}",
    emailBody: "Tere {eesnimi}!\n\nSinu broneering ({teenus}, {kuupäev} kell {kellaaeg}) on tühistatud.\nKui tasusid ettemaksu, tagastame selle 3–5 tööpäeva jooksul.\n\nUus aeg: {link}\n\n{salong}",
    smsBody: "{salong}: {teenus} {kuupäev} kell {kellaaeg} on tühistatud.",
  },
  {
    type: "PAYMENT_PENDING", title: "Ettemaks pooleli", timing: "pärast, kui makse puudub", emailEnabled: true, smsEnabled: false, offsetMinutes: 30,
    offsetOptions: [{ value: 15, label: "15 min" }, { value: 30, label: "30 min" }, { value: 60, label: "1 h" }],
    emailSubject: "Lõpeta broneering – {teenus} {kuupäev}",
    emailBody: "Tere {eesnimi}!\n\nSinu broneering ootab ettemaksu. Maksa siin: {link}\n\n{salong}",
    smsBody: "{salong}: lõpeta broneering ja tasu ettemaks: {link}",
  },
  {
    type: "WAITLIST", title: "Ootenimekiri – aeg vabanes", timing: "Kohe, esimesele järjekorras", emailEnabled: true, smsEnabled: true, offsetMinutes: null,
    emailSubject: "Aeg vabanes – {teenus} {kuupäev}",
    emailBody: "Tere {eesnimi}!\n\nSoovitud päeval vabanes aeg: {teenus} {kuupäev} kell {kellaaeg}.\nBroneeri kiiresti: {link}\n\n{salong}",
    smsBody: "{salong}: vabanes aeg {kuupäev} kell {kellaaeg} ({teenus}). Broneeri: {link}",
  },
  {
    type: "REVIEW", title: "Arvustuse küsimine", timing: "pärast külastust · Google", emailEnabled: false, smsEnabled: false, offsetMinutes: 120,
    offsetOptions: [{ value: 120, label: "2 h" }, { value: 1440, label: "1 päev" }],
    emailSubject: "Kuidas meeldis, {eesnimi}?",
    emailBody: "Tere {eesnimi}!\n\nAitäh, et külastasid {salong}. Oleksime tänulikud, kui jagaksid oma kogemust: {link}\n\n{salong}",
    smsBody: "Aitäh külastuse eest, {eesnimi}! Jäta meile arvustus: {link}",
  },
  {
    type: "BIRTHDAY", title: "Sünnipäevatervitus", timing: "Sünnipäeva hommikul · ainult nõusolekuga", emailEnabled: false, smsEnabled: false, offsetMinutes: null,
    emailSubject: "Palju õnne, {eesnimi}!",
    emailBody: "Palju õnne sünnipäevaks, {eesnimi}!\n\nSoovime sulle ilusat päeva.\n{salong}",
    smsBody: "Palju õnne sünnipäevaks, {eesnimi}! Soovib {salong}",
  },
];

/** Asenda mallis muutujad */
export function renderTemplate(template: string, vars: Partial<Record<(typeof VARIABLES)[number], string>>): string {
  return template.replace(/\{[a-zäöüõ]+\}/g, (m) => vars[m as (typeof VARIABLES)[number]] ?? m);
}

/** GSM-7 tähestik (koos laiendusega); muu märk → UCS-2 (70 märki SMS kohta) */
const GSM = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";

export function smsSegments(text: string): { chars: number; segments: number; perSegment: number; unicode: boolean } {
  const unicode = [...text].some((c) => !GSM.includes(c) && !GSM_EXT.includes(c));
  const chars = unicode ? [...text].length : [...text].reduce((a, c) => a + (GSM_EXT.includes(c) ? 2 : 1), 0);
  const single = unicode ? 70 : 160;
  const multi = unicode ? 67 : 153;
  const segments = chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  return { chars, segments, perSegment: segments <= 1 ? single : multi, unicode };
}
