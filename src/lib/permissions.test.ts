import { describe, expect, it } from "vitest";
import { canAccess, manageableRoles } from "./permissions";

describe("õigused", () => {
  it("töötaja ei pääse halduse lehtedele", () => {
    expect(canAccess("STAFF", "/toolaud")).toBe(true);
    expect(canAccess("STAFF", "/kalender")).toBe(true);
    expect(canAccess("STAFF", "/kliendid/abc")).toBe(true);
    expect(canAccess("STAFF", "/kliendid/export")).toBe(false);
    expect(canAccess("STAFF", "/aruanded")).toBe(false);
    expect(canAccess("STAFF", "/teenused/uus")).toBe(false);
    expect(canAccess("STAFF", "/seaded")).toBe(true);
  });
  it("administraator ei pääse paketile", () => {
    expect(canAccess("ADMIN", "/aruanded")).toBe(true);
    expect(canAccess("ADMIN", "/seaded/pakett")).toBe(false);
    expect(canAccess("OWNER", "/seaded/pakett")).toBe(true);
  });
  it("kutsumise õigused", () => {
    expect(manageableRoles("OWNER")).toEqual(["ADMIN", "STAFF"]);
    expect(manageableRoles("ADMIN")).toEqual(["STAFF"]);
    expect(manageableRoles("STAFF")).toEqual([]);
  });
});
