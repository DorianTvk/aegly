/** Aegly kuutellimuse paketid. Kõik funktsioonid on igas paketis, erineb ainult töötajate arv. */
export const PLAN_IDS = ["SOLO", "SALONG", "SUUR"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type BillingPeriod = "MONTH" | "YEAR";
export type PlanStatus = "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "PENDING";

export type Plan = {
  id: PlanId;
  name: string;
  /** null = piiramatu */
  staffLimit: number | null;
  /** sentides, ilma käibemaksuta */
  monthlyCents: number;
  yearlyCents: number;
  tagline: string;
};

export const PLANS: Record<PlanId, Plan> = {
  SOLO: { id: "SOLO", name: "Solo", staffLimit: 1, monthlyCents: 900, yearlyCents: 9000, tagline: "Üksi töötavale spetsialistile" },
  SALONG: { id: "SALONG", name: "Tiim", staffLimit: 6, monthlyCents: 1900, yearlyCents: 19000, tagline: "Väikesele meeskonnale" },
  SUUR: { id: "SUUR", name: "Ettevõte", staffLimit: 12, monthlyCents: 2900, yearlyCents: 29000, tagline: "Suuremale meeskonnale" },
};

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  ACTIVE: "Aktiivne",
  PAST_DUE: "Makse ootel",
  SUSPENDED: "Peatatud",
  PENDING: "Ootab makset",
};

/** Müügilehe ?pakett= väärtus → paketi id (tundmatu → Salong) */
export function parsePlan(v: unknown): PlanId {
  const s = String(v ?? "").toUpperCase();
  return (PLAN_IDS as readonly string[]).includes(s) ? (s as PlanId) : "SALONG";
}

export function parsePeriod(v: unknown): BillingPeriod {
  return String(v ?? "").toUpperCase() === "YEAR" ? "YEAR" : "MONTH";
}

export function planPrice(plan: PlanId, period: BillingPeriod): number {
  return period === "YEAR" ? PLANS[plan].yearlyCents : PLANS[plan].monthlyCents;
}

/** Kas saab lisada (või uuesti aktiveerida) ühe töötaja juurde */
export function canAddStaff(plan: PlanId, activeStaff: number): boolean {
  const limit = PLANS[plan].staffLimit;
  return limit === null || activeStaff < limit;
}

/** Kas paketi vahetus on lubatud praeguse aktiivsete töötajate arvuga */
export function canSwitchTo(plan: PlanId, activeStaff: number): boolean {
  const limit = PLANS[plan].staffLimit;
  return limit === null || activeStaff <= limit;
}

/** Väikseim pakett, kuhu antud arv töötajaid mahub */
export function smallestPlanFor(activeStaff: number): PlanId {
  return PLAN_IDS.find((p) => canSwitchTo(p, activeStaff)) ?? "SUUR";
}

/** Suurematele (üle Suure paketi piiri) kokkuleppehind */
export const ENTERPRISE_EMAIL = process.env.NEXT_PUBLIC_SALES_EMAIL || "info@aegly.ee";
export const ENTERPRISE_NOTE = `Rohkem kui ${PLANS.SUUR.staffLimit} töötajat või mitu asukohta? Kirjuta ${ENTERPRISE_EMAIL} – teeme pakkumise.`;

export function staffLimitText(plan: PlanId): string {
  const l = PLANS[plan].staffLimit;
  return l === null ? "Piiramatult töötajaid" : l === 1 ? "1 töötaja" : `Kuni ${l} töötajat`;
}

/** Teade, kui töötajate piir on täis */
export function staffLimitMessage(plan: PlanId): string {
  const next = PLAN_IDS[PLAN_IDS.indexOf(plan) + 1];
  const limit = PLANS[plan].staffLimit;
  if (!next) return `Paketis „${PLANS[plan].name}“ on kuni ${limit} töötajat. Suurema meeskonna jaoks kirjuta ${ENTERPRISE_EMAIL} – teeme sulle pakkumise.`;
  return `Sinu paketis „${PLANS[plan].name}“ on ${limit === 1 ? "1 töötaja" : `kuni ${limit} töötajat`}. Vaheta pakett „${PLANS[next].name}“ vastu (${PLANS[next].monthlyCents / 100} €/kuu), et lisada rohkem.`;
}

/** Platvormi haldurid (superadmin) – e-postid keskkonnamuutujast SUPERADMIN_EMAILS, komaga eraldatud */
export function isSuperadmin(email: string, env = process.env.SUPERADMIN_EMAILS): boolean {
  if (!env) return false;
  return env
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}
