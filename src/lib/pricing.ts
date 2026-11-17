/**
 * Hinna mootor (Figma raport R2, "2. Hinna ja soodustuste arvutus").
 *
 * Järjekord on alati sama:
 *  1. Baashind (teenus)
 *  2. Töötaja hind – asendab baashinna, kui töötajal on oma hind
 *  3. Hinnareeglid – lisatasud ja soodustused (nädalavahetus, õhtu, viimane hetk, pühad)
 *  4. Kampaania – rakendub automaatselt, kui periood ja tingimused sobivad; mitmest valitakse soodsaim
 *  5. Sooduskood – kliendi sisestatud
 *  6. Ettemaks ja KM – ettemaks % lõpphinnast; KM arvutatakse hinnast välja (hinnad sisaldavad KM-i)
 *
 * Kombineerimine: kui kampaania või kood ei ole kombineeritav, rakendub ainult suurem soodustus.
 * Kõik summad sentides.
 */

export type PriceContext = {
  isoDate: string; // kohalik kuupäev
  weekday: number; // 1 = E … 7 = P
  startMinutes: number; // algus minutites südaööst
  leadHours: number; // mitu tundi enne algust broneeritakse
  serviceId: string;
  categoryId: string | null;
  staffId: string | null;
};

type Conditions = {
  weekdays: number[];
  fromTime: string | null;
  toTime: string | null;
  serviceIds: string[];
  categoryIds: string[];
};

export type PriceRuleInput = Conditions & {
  id: string;
  name: string;
  kind: "PERCENT" | "FIXED" | "FIXED_PRICE";
  /** positiivne = lisatasu, negatiivne = soodustus; % või senti */
  value: number;
  minLeadHours: number | null;
  maxLeadHours: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  active: boolean;
};

export type CampaignInput = Conditions & {
  id: string;
  name: string;
  kind: "PERCENT" | "FIXED" | "FIXED_PRICE";
  /** soodustus: 20 = −20 %, 2000 = −20 €, FIXED_PRICE: uus hind sentides */
  value: number;
  startsAt: Date;
  endsAt: Date;
  staffIds: string[];
  combinable: boolean;
  active: boolean;
};

export type CodeInput = {
  id: string;
  code: string;
  kind: "PERCENT" | "FIXED" | "FREE_SERVICE";
  value: number;
  minAmountCents: number | null;
  combinable: boolean;
  serviceIds: string[];
  categoryIds: string[];
};

export type PriceLine = { label: string; amountCents: number; kind: "base" | "staff" | "rule" | "campaign" | "code" | "info" };

export type PriceResult = {
  baseCents: number;
  staffCents: number;
  afterRulesCents: number;
  finalCents: number;
  depositCents: number;
  payOnSiteCents: number;
  vatCents: number;
  lines: PriceLine[];
  campaign: { id: string; name: string; discountCents: number } | null;
  code: { id: string; code: string; discountCents: number } | null;
  /** miks koodi ei rakendatud, kui sisestati */
  codeRejected?: "min-amount" | "not-applicable" | "not-combinable";
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pct = (amount: number, percent: number) => Math.round((amount * percent) / 100);

function matchesConditions(c: Conditions, ctx: PriceContext): boolean {
  if (c.weekdays.length && !c.weekdays.includes(ctx.weekday)) return false;
  if (c.fromTime && ctx.startMinutes < toMin(c.fromTime)) return false;
  if (c.toTime && ctx.startMinutes >= toMin(c.toTime)) return false;
  // teenuse või kategooria sihtimine: kui mõlemad tühjad, kehtib kõigile
  const targeted = c.serviceIds.length > 0 || c.categoryIds.length > 0;
  if (targeted) {
    const hit = c.serviceIds.includes(ctx.serviceId) || (ctx.categoryId !== null && c.categoryIds.includes(ctx.categoryId));
    if (!hit) return false;
  }
  return true;
}

export function ruleApplies(r: PriceRuleInput, ctx: PriceContext): boolean {
  if (!r.active || !matchesConditions(r, ctx)) return false;
  if (r.minLeadHours !== null && ctx.leadHours < r.minLeadHours) return false;
  if (r.maxLeadHours !== null && ctx.leadHours >= r.maxLeadHours) return false;
  if (r.dateFrom && ctx.isoDate < r.dateFrom) return false;
  if (r.dateTo && ctx.isoDate > r.dateTo) return false;
  return true;
}

export function campaignApplies(c: CampaignInput, ctx: PriceContext, at: Date): boolean {
  if (!c.active || at < c.startsAt || at > c.endsAt) return false;
  if (c.staffIds.length && (!ctx.staffId || !c.staffIds.includes(ctx.staffId))) return false;
  return matchesConditions(c, ctx);
}

function campaignDiscount(c: CampaignInput, price: number): number {
  if (c.kind === "PERCENT") return pct(price, c.value);
  if (c.kind === "FIXED") return Math.min(price, c.value);
  return Math.max(0, price - c.value); // FIXED_PRICE
}

export function codeAppliesToService(code: CodeInput, ctx: PriceContext): boolean {
  if (!code.serviceIds.length && !code.categoryIds.length) return true;
  return code.serviceIds.includes(ctx.serviceId) || (ctx.categoryId !== null && code.categoryIds.includes(ctx.categoryId));
}

function codeDiscount(code: CodeInput, price: number): number {
  if (code.kind === "PERCENT") return pct(price, code.value);
  if (code.kind === "FIXED") return Math.min(price, code.value);
  return price; // FREE_SERVICE
}

const sign = (n: number) => (n > 0 ? "+" : "−");
const describe = (kind: string, value: number) =>
  kind === "PERCENT" ? `${sign(value)}${Math.abs(value)} %` : `${sign(value)}${(Math.abs(value) / 100).toFixed(2).replace(".", ",")} €`;

export function computePrice(input: {
  ctx: PriceContext;
  at: Date;
  baseCents: number;
  staffPriceCents: number | null;
  rules: PriceRuleInput[];
  campaigns: CampaignInput[];
  code?: CodeInput | null;
  depositPercent: number;
  vatPercent: number;
  pricesIncludeVat?: boolean;
}): PriceResult {
  const { ctx } = input;
  const lines: PriceLine[] = [{ label: "Baashind", amountCents: input.baseCents, kind: "base" }];

  // 2. töötaja hind
  const staffCents = input.staffPriceCents ?? input.baseCents;
  if (input.staffPriceCents !== null && input.staffPriceCents !== input.baseCents) {
    lines.push({ label: "Töötaja hind", amountCents: staffCents - input.baseCents, kind: "staff" });
  }

  // 3. hinnareeglid – kõik kehtivad arvutatakse töötaja hinnast ja liidetakse
  let price = staffCents;
  for (const r of input.rules.filter((r) => ruleApplies(r, ctx))) {
    const delta = r.kind === "PERCENT" ? pct(staffCents, r.value) : r.kind === "FIXED" ? r.value : r.value - staffCents;
    price += delta;
    lines.push({ label: `${r.name} ${describe(r.kind === "FIXED_PRICE" ? "FIXED" : r.kind, r.kind === "FIXED_PRICE" ? delta : r.value)}`, amountCents: delta, kind: "rule" });
  }
  price = Math.max(0, price);
  const afterRules = price;

  // 4. kampaania – soodsaim kehtivatest
  const candidates = input.campaigns
    .filter((c) => campaignApplies(c, ctx, input.at))
    .map((c) => ({ c, discount: campaignDiscount(c, afterRules) }))
    .sort((a, b) => b.discount - a.discount);
  let campaign: (typeof candidates)[number] | null = candidates[0] ?? null;

  // 5. sooduskood
  let code: PriceResult["code"] = null;
  let codeRejected: PriceResult["codeRejected"];
  if (input.code) {
    const k = input.code;
    if (!codeAppliesToService(k, ctx)) codeRejected = "not-applicable";
    else if (k.minAmountCents !== null && afterRules < k.minAmountCents) codeRejected = "min-amount";
    else {
      const combinable = !campaign || (campaign.c.combinable && k.combinable);
      if (combinable) {
        const base = afterRules - (campaign?.discount ?? 0);
        code = { id: k.id, code: k.code, discountCents: codeDiscount(k, base) };
      } else {
        // ainult suurem soodustus
        const codeOnly = codeDiscount(k, afterRules);
        if (codeOnly > campaign!.discount) {
          code = { id: k.id, code: k.code, discountCents: codeOnly };
          campaign = null;
        } else codeRejected = "not-combinable";
      }
    }
  }

  if (campaign) {
    price -= campaign.discount;
    lines.push({ label: `Kampaania ${campaign.c.name} ${campaign.c.kind === "FIXED_PRICE" ? "" : describe(campaign.c.kind, -campaign.c.value)}`.trim(), amountCents: -campaign.discount, kind: "campaign" });
  }
  if (code) {
    price -= code.discountCents;
    const k = input.code!;
    lines.push({ label: `Sooduskood ${k.code}${k.kind === "FREE_SERVICE" ? " (tasuta)" : ` ${describe(k.kind, -k.value)}`}`, amountCents: -code.discountCents, kind: "code" });
  }
  price = Math.max(0, price);

  // 6. ettemaks ja KM
  const deposit = pct(price, input.depositPercent);
  const includeVat = input.pricesIncludeVat ?? true;
  const vat = includeVat ? Math.round((price * input.vatPercent) / (100 + input.vatPercent)) : pct(price, input.vatPercent);

  return {
    baseCents: input.baseCents,
    staffCents,
    afterRulesCents: afterRules,
    finalCents: price,
    depositCents: deposit,
    payOnSiteCents: price - deposit,
    vatCents: vat,
    lines,
    campaign: campaign ? { id: campaign.c.id, name: campaign.c.name, discountCents: campaign.discount } : null,
    code,
    codeRejected,
  };
}
