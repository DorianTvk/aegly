import "server-only";
import { cookies } from "next/headers";
import { isSuperadmin } from "./plans";
import { RETURN_COOKIE } from "./session";

export const VIEW_COOKIE = "aegly_view";

/**
 * Platvormi haldur näeb vaikimisi platvormi vaadet (kliendid, tulu).
 * "Salongi vaade" (oma demosalong) või "Logi sisse kui" näitab tavalist halduspaneeli.
 */
export async function isPlatformMode(user: { email: string }): Promise<boolean> {
  if (!isSuperadmin(user.email)) return false;
  const store = await cookies();
  if (store.has(RETURN_COOKIE)) return false;
  return store.get(VIEW_COOKIE)?.value !== "salon";
}
