/**
 * Eesti riigipühad ja lühendatud tööpäevad (pühade ja tähtpäevade seadus, töölepingu seadus § 53).
 * Lühendatud päev: iseseisvuspäeva, võidupüha, jõululaupäeva ja uusaasta eelne tööpäev on 3 tundi lühem.
 */
import { addDaysIso } from "./time";

export type NationalHoliday = { date: string; name: string; kind: "closed" | "short" };

/** Lihavõtted (Gaussi/Meeuse algoritm, Gregoriuse kalender) */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function estonianHolidays(year: number): NationalHoliday[] {
  const y = (md: string) => `${year}-${md}`;
  const easter = easterSunday(year);
  const closed: NationalHoliday[] = [
    { date: y("01-01"), name: "Uusaasta", kind: "closed" },
    { date: y("02-24"), name: "Iseseisvuspäev", kind: "closed" },
    { date: addDaysIso(easter, -2), name: "Suur reede", kind: "closed" },
    { date: easter, name: "Ülestõusmispühade 1. püha", kind: "closed" },
    { date: y("05-01"), name: "Kevadpüha", kind: "closed" },
    { date: addDaysIso(easter, 49), name: "Nelipühade 1. püha", kind: "closed" },
    { date: y("06-23"), name: "Võidupüha", kind: "closed" },
    { date: y("06-24"), name: "Jaanipäev", kind: "closed" },
    { date: y("08-20"), name: "Taasiseseisvumispäev", kind: "closed" },
    { date: y("12-24"), name: "Jõululaupäev", kind: "closed" },
    { date: y("12-25"), name: "Esimene jõulupüha", kind: "closed" },
    { date: y("12-26"), name: "Teine jõulupüha", kind: "closed" },
  ];
  const short: NationalHoliday[] = [
    { date: y("02-23"), name: "Iseseisvuspäeva eelne päev", kind: "short" },
    { date: y("06-22"), name: "Võidupüha eelne päev", kind: "short" },
    { date: y("12-23"), name: "Jõululaupäeva eelne päev", kind: "short" },
    { date: y("12-31"), name: "Vana-aasta õhtu", kind: "short" },
  ];
  const closedDates = new Set(closed.map((h) => h.date));
  return [...closed, ...short.filter((s) => !closedDates.has(s.date))].sort((a, b) => a.date.localeCompare(b.date));
}

/** Pühad vahemikus [from, to] (kaasa arvatud) */
export function holidaysBetween(from: string, to: string): NationalHoliday[] {
  const years = new Set([Number(from.slice(0, 4)), Number(to.slice(0, 4))]);
  return [...years].flatMap(estonianHolidays).filter((h) => h.date >= from && h.date <= to);
}
