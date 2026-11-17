import { loadManaged } from "@/server/manage";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");

/** "Lisa kalendrisse" – iCalendar fail */
export async function GET(req: Request, ctx: RouteContext<"/b/[token]/kalender.ics">) {
  const { token } = await ctx.params;
  const m = await loadManaged(token);
  if (!m) return new Response("Not found", { status: 404 });
  const { booking: b, business: biz } = m;
  const url = new URL(`/b/${token}`, req.url).toString();
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Aegly//Broneering//ET", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@aegly`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(b.startsAt)}`,
    `DTEND:${stamp(b.endsAt)}`,
    `SUMMARY:${esc(`${b.service.name} – ${biz.name}`)}`,
    `DESCRIPTION:${esc(`Spetsialist: ${b.staff.name}\nBroneering ${b.number}\nMuuda või tühista: ${url}`)}`,
    ...(biz.address ? [`LOCATION:${esc(biz.address)}`] : []),
    `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${b.number}.ics"` } });
}
