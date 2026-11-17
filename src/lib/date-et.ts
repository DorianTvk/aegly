import { isoWeekday } from "./time";

const WD = ["esmaspäev", "teisipäev", "kolmapäev", "neljapäev", "reede", "laupäev", "pühapäev"];
const WD_SHORT = ["E", "T", "K", "N", "R", "L", "P"];
const MONTHS = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];
const MONTHS_SHORT = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];

const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "Teisipäev, 3. november" */
export const dayLong = (iso: string) => `${cap(WD[isoWeekday(iso) - 1])}, ${parts(iso)[2]}. ${MONTHS[parts(iso)[1] - 1]}`;
/** "T 3. nov" */
export const dayShort = (iso: string) => `${WD_SHORT[isoWeekday(iso) - 1]} ${parts(iso)[2]}. ${MONTHS_SHORT[parts(iso)[1] - 1]}`;
/** "T 3. nov 2026" */
export const dayShortYear = (iso: string) => `${dayShort(iso)} ${parts(iso)[0]}`;
/** "November 2026" */
export const monthYear = (iso: string) => `${cap(MONTHS[parts(iso)[1] - 1])} ${parts(iso)[0]}`;
export const weekdayLetter = (iso: string) => WD_SHORT[isoWeekday(iso) - 1];
export const dayNum = (iso: string) => String(parts(iso)[2]).padStart(2, "0");
/** "15:30" + minutid → "16:30" */
export function addMinutes(hhmm: string, min: number): string {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
