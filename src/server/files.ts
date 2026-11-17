import "server-only";
import { db, schema as s } from "@/db";

const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Salvestab pildi ja tagastab avaliku URL-i (/api/files/:id) */
export async function storeImage(businessId: string, file: File): Promise<{ ok: true; url: string } | { ok: false; reason: string }> {
  if (!ALLOWED.includes(file.type)) return { ok: false, reason: "Lubatud on PNG, JPG, WebP või SVG" };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: "Fail on suurem kui 2 MB" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (file.type === "image/svg+xml") {
    // SVG võib sisaldada skripte – lubame ainult puhtad failid
    const text = buf.toString("utf8").toLowerCase();
    if (text.includes("<script") || /\son\w+\s*=/.test(text) || text.includes("javascript:")) return { ok: false, reason: "SVG sisaldab lubamatut sisu" };
  }
  const [row] = await db
    .insert(s.files)
    .values({ businessId, name: file.name.slice(0, 120), contentType: file.type, size: buf.length, data: buf.toString("base64") })
    .returning({ id: s.files.id });
  return { ok: true, url: `/api/files/${row.id}` };
}
