import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Avalik failide lugemine (logo, bänner, teenuse pilt) – vidin vajab neid ilma sisselogimiseta */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const f = await db.query.files.findFirst({ where: eq(s.files.id, id) });
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(f.data, "base64"), {
    headers: {
      "Content-Type": f.contentType,
      "Content-Length": String(f.size),
      // id muutub iga üleslaadimisega, seega võib vahemällu jätta pikalt
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      // ka otse avatud SVG ei saa käivitada skripte ega laadida väliseid ressursse
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
    },
  });
}
