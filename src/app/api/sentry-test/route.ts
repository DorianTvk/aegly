import { readSession } from "@/lib/session";
import { isSuperadmin } from "@/lib/plans";

/** Platvormi haldurile: kontrolli, et Sentry saab vead kätte (viskab meelega vea) */
export async function GET() {
  const session = await readSession();
  if (!session || !isSuperadmin(session.user.email)) return new Response(null, { status: 404 });
  throw new Error(`Aegly Sentry testviga ${new Date().toISOString()}`);
}
