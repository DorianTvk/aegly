import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Profiili- ja teenusepildid. Iga üleslaadimine saab uue id, seega võib vahemälu olla igavene. */
export async function GET(_req: Request, ctx: RouteContext<"/api/pilt/[id]">) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9]{10,40}$/.test(id)) return new Response(null, { status: 404 });
  const img = await db.query.images.findFirst({ where: eq(s.images.id, id) });
  if (!img) return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
