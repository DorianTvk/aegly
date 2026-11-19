import { reportError } from "@/lib/report";
import { runScheduledNotifications } from "@/server/notify";
import { expireUnpaidHolds } from "@/server/stripe";

/**
 * Meeldetuletused ja arvustuse küsimine. Käivitatakse iga 15 minuti järel (vercel.json → crons).
 * Kaitstud CRON_SECRET-iga: Vercel saadab päise "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const base = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const result = await runScheduledNotifications(base);
  const expiredHolds = await expireUnpaidHolds().catch((e) => { reportError("stripe holds", e); return 0; });
  return Response.json({ ok: true, ...result, expiredHolds });
}
