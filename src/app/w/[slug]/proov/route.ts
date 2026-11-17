import { findPublicBusiness } from "@/server/widget";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Näidiskoduleht, kus vidin on paigaldatud nagu salongi enda lehel (pop-up nupu test) */
export async function GET(req: Request, ctx: RouteContext<"/w/[slug]/proov">) {
  const { slug } = await ctx.params;
  const b = await findPublicBusiness(slug);
  if (!b) return new Response("Not found", { status: 404 });
  const origin = new URL(req.url).origin;
  const html = `<!doctype html><html lang="et"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(b.name)} – näidisleht</title><meta name="robots" content="noindex">
<style>body{margin:0;font-family:Georgia,serif;color:#1f2a2a;background:#faf7f2}header{padding:20px 32px;display:flex;justify-content:space-between;align-items:center}
main{max-width:880px;margin:0 auto;padding:64px 32px}h1{font-size:48px;margin:0 0 16px}p{font-size:19px;line-height:1.6;color:#4b5563}
a.btn{display:inline-block;margin-top:24px;padding:14px 24px;border-radius:999px;background:${esc(b.widgetPrimary)};color:${esc(b.widgetButtonColor)};text-decoration:none;font-family:system-ui,sans-serif;font-weight:600}
.note{margin-top:48px;font:14px system-ui,sans-serif;color:#6b7280}</style></head><body>
<header><strong>${esc(b.name)}</strong><span style="font:14px system-ui">${esc(b.address ?? "")}</span></header>
<main><h1>Leia aeg iseendale</h1><p>${esc(b.description ?? "See on näidiskoduleht, mis näitab, kuidas Aegly broneerimisvidin sinu lehel välja näeb.")}</p>
<a class="btn" href="#" data-aegly-open>Broneeri aeg</a>
<p class="note">Näidisleht: vidin on lisatud ühe koodireaga. Nupp paremas alanurgas ja iga element atribuudiga <code>data-aegly-open</code> avavad broneerimise.</p></main>
<script src="${origin}/w/aegly.js" data-salon="${esc(b.slug)}" async></script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
