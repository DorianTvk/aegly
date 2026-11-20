/**
 * Rollid ja õigused.
 * OWNER – kõik (sh pakett, kasutajad, konto kustutamine)
 * ADMIN – kõik peale paketi/arvelduse ja konto kustutamise; kutsub ainult töötajaid
 * STAFF – töölaud, oma kalender ja broneeringud, kliendid (vaatamiseks), oma konto seaded
 */
export type Role = "OWNER" | "ADMIN" | "STAFF";

export const MANAGERS: Role[] = ["OWNER", "ADMIN"];

/** Halduspaneeli teed, kuhu töötaja ei pääse (kõik alamteed kaasa arvatud) */
const MANAGER_ONLY = [
  "/aruanded", "/teenused", "/paketid", "/hinnakiri", "/tootajad", "/tooajad", "/sooduskoodid",
  "/kampaaniad", "/kinkekaardid", "/vidin", "/profiil", "/teavitused", "/kliendid/export", "/seaded/logi",
];
const OWNER_ONLY = ["/seaded/pakett"];

const under = (path: string, prefix: string) => path === prefix || path.startsWith(prefix + "/");

export function canAccess(role: Role, path: string): boolean {
  if (OWNER_ONLY.some((p) => under(path, p))) return role === "OWNER";
  if (MANAGER_ONLY.some((p) => under(path, p))) return role !== "STAFF";
  return true;
}

export const isManager = (role: Role) => role !== "STAFF";

/** Milliseid rolle tohib see roll kutsuda / hallata */
export function manageableRoles(role: Role): ("ADMIN" | "STAFF")[] {
  return role === "OWNER" ? ["ADMIN", "STAFF"] : role === "ADMIN" ? ["STAFF"] : [];
}
