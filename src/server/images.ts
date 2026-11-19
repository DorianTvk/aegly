import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Maksimaalne pildi suurus pärast brauseris vähendamist */
const MAX_BYTES = 300_000;
const TYPES = ["image/webp", "image/jpeg", "image/png"];
const PREFIX = "/api/pilt/";

/**
 * Vormi välja "image" väärtus: "" = muutmata, "remove" = eemalda, "data:image/...;base64,..." = uus pilt.
 * Tagastab uue URL-i (string), null (eemaldatud) või undefined (muutmata). Vana pilt kustutatakse.
 */
export async function applyImageField(businessId: string, field: FormDataEntryValue | null, currentUrl: string | null): Promise<string | null | undefined> {
  const v = typeof field === "string" ? field : "";
  if (!v) return undefined;
  if (v === "remove") {
    await deleteImage(businessId, currentUrl);
    return null;
  }
  const m = /^data:(image\/[a-z]+);base64,([A-Za-z0-9+/=]+)$/.exec(v);
  if (!m || !TYPES.includes(m[1])) throw new Error("Vigane pilt");
  const data = Buffer.from(m[2], "base64");
  if (data.length > MAX_BYTES) throw new Error("Pilt on liiga suur");
  const [row] = await db.insert(s.images).values({ businessId, contentType: m[1], data }).returning({ id: s.images.id });
  await deleteImage(businessId, currentUrl);
  return PREFIX + row.id;
}

export async function deleteImage(businessId: string, url: string | null) {
  if (!url?.startsWith(PREFIX)) return;
  await db.delete(s.images).where(and(eq(s.images.id, url.slice(PREFIX.length)), eq(s.images.businessId, businessId)));
}
