/**
 * Arendusaja pääsuparool kogu lehele (SITE_PASSWORD). Kui muutuja puudub, on värav väljas.
 * Küpsis hoiab parooli räsi, mitte parooli ennast; parooli vahetamisel kehtetuks.
 */
export const GATE_COOKIE = "aegly_gate";

export const gateEnabled = () => !!process.env.SITE_PASSWORD;

export async function gateToken(): Promise<string> {
  const data = new TextEncoder().encode(`aegly-gate:${process.env.SITE_PASSWORD ?? ""}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
