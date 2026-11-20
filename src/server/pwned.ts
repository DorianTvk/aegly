import "server-only";
import { createHash } from "node:crypto";
import { reportError } from "@/lib/report";
import { checkPasswordPolicy } from "@/lib/password-policy";

/**
 * Kas parool on avalikes andmelekete kogumites (Have I Been Pwned, k-anonüümsus):
 * teenusele saadetakse ainult SHA-1 räsi esimesed 5 märki, parooli ega täisräsi mitte.
 * Teenuse rikke korral parooli ei blokeerita (kasutaja ei jää hätta).
 */
export async function pwnedCount(password: string, fetcher: typeof fetch = fetch): Promise<number | null> {
  if (process.env.HIBP_DISABLED === "1") return null;
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetcher(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "Aegly-password-check" },
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!res.ok) return null;
    for (const line of (await res.text()).split("\n")) {
      const [s, n] = line.trim().split(":");
      if (s === suffix) return Number(n) || 0;
    }
    return 0;
  } catch (e) {
    reportError("pwned check", e);
    return null;
  }
}

/** Kogu kontroll uuele paroolile: reeglid + lekete kontroll. Tagastab vea teksti või null. */
export async function validateNewPassword(pw: string, context: { email?: string | null; name?: string | null; business?: string | null }): Promise<string | null> {
  const policy = checkPasswordPolicy(pw, context);
  if (policy) return policy;
  const n = await pwnedCount(pw);
  if (n && n > 0) return "See parool on avalikult lekkinud paroolide nimekirjas. Vali mõni muu parool.";
  return null;
}
