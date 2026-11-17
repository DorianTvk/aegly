import { TZDate } from "@date-fns/tz";

export const DEFAULT_TZ = "Europe/Tallinn";

/** "09:30" → 570 */
export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 570 → "09:30" */
export function fromMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Kuupäev "2026-11-03" + kellaaeg "10:30" ettevõtte ajavööndis → Date (UTC). */
export function zonedDateTime(isoDate: string, hhmm: string, tz = DEFAULT_TZ): Date {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(new TZDate(y, mo - 1, d, h, mi, 0, tz).getTime());
}

/** Date → "2026-11-03" ettevõtte ajavööndis */
export function localDate(date: Date, tz = DEFAULT_TZ): string {
  const z = new TZDate(date.getTime(), tz);
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
}

/** Date → minutid südaööst ettevõtte ajavööndis */
export function localMinutes(date: Date, tz = DEFAULT_TZ): number {
  const z = new TZDate(date.getTime(), tz);
  return z.getHours() * 60 + z.getMinutes();
}

/** Date → "09:30" ettevõtte ajavööndis */
export function localTime(date: Date, tz = DEFAULT_TZ): string {
  return fromMinutes(localMinutes(date, tz));
}

/** ISO nädalapäev 1 = E … 7 = P kuupäevale "2026-11-03" */
export function isoWeekday(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** Lisa päevi kuupäevale "2026-11-03" */
export function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function todayIso(tz = DEFAULT_TZ): string {
  return localDate(new Date(), tz);
}

const WEEKDAYS = ["esmaspäev", "teisipäev", "kolmapäev", "neljapäev", "reede", "laupäev", "pühapäev"];
const MONTHS = [
  "jaanuar", "veebruar", "märts", "aprill", "mai", "juuni",
  "juuli", "august", "september", "oktoober", "november", "detsember",
];

/** "Reede, 30. oktoober 2026" */
export function formatLongDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const wd = WEEKDAYS[isoWeekday(isoDate) - 1];
  return `${wd[0].toUpperCase()}${wd.slice(1)}, ${d}. ${MONTHS[m - 1]} ${y}`;
}

/** "30.10.2026" */
export function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}.${m}.${y}`;
}

/** 4280_00 senti → "4 280 €", 5550 → "55,50 €" */
export function formatEuro(cents: number, opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? cents % 100 !== 0;
  const value = cents / 100;
  const s = value.toLocaleString("et-EE", {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  });
  return `${s.replace(/ /g, " ")} €`;
}
