import "server-only";
import { cookies } from "next/headers";
import { db, schema as s } from "@/db";
import { readSession, RETURN_COOKIE, sessionUserByToken } from "@/lib/session";
import { clientIp } from "@/server/bot-protection";
import { reportError } from "@/lib/report";

type Target = { type: string; id: string };

/**
 * Kirjuta tegevuste logisse, kes mida tegi. Vaikimisi võetakse tegija ja ettevõte sessioonist;
 * "logi sisse kui" ajal märgitakse ka platvormi halduri e-post.
 * Logimise viga ei katkesta kunagi tegevust ennast.
 */
export async function logActivity(entry: {
  action: string;
  summary: string;
  target?: Target;
  businessId?: string | null;
  actor?: { name: string; email?: string | null; userId?: string | null };
}) {
  try {
    const session = entry.actor ? null : await readSession();
    const actor = entry.actor ?? (session ? { name: session.user.name, email: session.user.email, userId: session.user.id } : { name: "Süsteem" });
    const businessId = entry.businessId !== undefined ? entry.businessId : (session?.business.id ?? null);
    const back = (await cookies()).get(RETURN_COOKIE)?.value;
    const admin = back ? await sessionUserByToken(back) : null;
    await db.insert(s.auditLog).values({
      businessId,
      userId: actor.userId ?? null,
      actorName: actor.name,
      actorEmail: actor.email ?? null,
      viaAdmin: admin?.email ?? null,
      action: entry.action,
      summary: entry.summary.slice(0, 300),
      targetType: entry.target?.type ?? null,
      targetId: entry.target?.id ?? null,
      ip: await clientIp().catch(() => null),
    });
  } catch (e) {
    reportError("logActivity", e, { action: entry.action });
  }
}
