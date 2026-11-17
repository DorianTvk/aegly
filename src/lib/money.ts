/** "55,00" | "55.5" | "55" → 5500 / 5550 / 5500 senti; tühi või vigane → null */
export function parseEuroToCents(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const s = input.replace(/\s|€/g, "").replace(",", ".");
  if (s === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** 5500 → "55,00" sisendvälja jaoks */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
