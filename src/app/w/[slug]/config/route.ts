import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { findPublicBusiness } from "@/server/widget";
import { recordActivity } from "@/server/activity";

const cors = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=60" };

/** Vidina käivitusnupu seaded (aegly.js loeb). Märgib ka vidina paigaldatuks, kui päring tuleb võõralt lehelt. */
export async function GET(req: Request, ctx: RouteContext<"/w/[slug]/config">) {
  const { slug } = await ctx.params;
  const b = await findPublicBusiness(slug);
  if (!b) return Response.json({ error: "not-found" }, { status: 404, headers: cors });

  const origin = req.headers.get("origin") ?? req.headers.get("referer") ?? "";
  let host = "";
  try {
    host = origin ? new URL(origin).host : "";
  } catch {}
  const own = host === new URL(req.url).host;
  if (host && !own && b.allowedDomains.length && !b.allowedDomains.some((d) => host === d || host.endsWith("." + d))) {
    return Response.json({ error: "domain-not-allowed" }, { status: 403, headers: cors });
  }
  if (host && !own && !b.widgetInstalledAt) {
    await db.update(s.businesses).set({ widgetInstalledAt: new Date() }).where(eq(s.businesses.id, b.id));
    await recordActivity(b.id, "WIDGET_INSTALLED", { body: `Esimene avamine lehelt ${host}` });
  }
  return Response.json({ name: b.name, primary: b.widgetPrimary, buttonColor: b.widgetButtonColor, buttonText: b.widgetButtonText }, { headers: cors });
}
