import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { findToken, markUsed } from "@/server/auth-tokens";

/** E-posti kinnitamise link: /kinnita?token=… */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  const row = await findToken(token, "VERIFY");
  if (!row?.userId) return Response.redirect(new URL("/toolaud?kinnitus=vigane", url), 303);
  await markUsed(token);
  await db.update(s.users).set({ emailVerifiedAt: new Date() }).where(eq(s.users.id, row.userId));
  return Response.redirect(new URL("/toolaud?kinnitus=ok", url), 303);
}
