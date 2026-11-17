import "server-only";
import { requireSession } from "./session";

/** Sisseloginud kasutaja ettevõte. Iga päring peab filtreerima selle id järgi. */
export async function getCurrentBusiness() {
  return (await requireSession()).business;
}

export async function getCurrentUser() {
  return (await requireSession()).user;
}

export const ROLE_LABEL = { OWNER: "Omanik", ADMIN: "Administraator", STAFF: "Töötaja" } as const;
