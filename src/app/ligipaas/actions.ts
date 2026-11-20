"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { GATE_COOKIE, gateEnabled, gateToken } from "@/lib/gate";
import { clientIp, recentAttempts, recordAttempt } from "@/server/bot-protection";

export async function unlock(_prev: { error?: string } | null, formData: FormData): Promise<{ error?: string } | null> {
  if (!gateEnabled()) redirect("/");
  const ip = await clientIp();
  if (ip !== "unknown" && (await recentAttempts("GATE", { ip }, 15)) >= 10) return { error: "Liiga palju katseid. Proovi 15 minuti pärast uuesti." };
  const given = Buffer.from(String(formData.get("password") ?? ""));
  const want = Buffer.from(process.env.SITE_PASSWORD ?? "");
  const ok = given.length === want.length && timingSafeEqual(given, want);
  if (!ok) {
    await recordAttempt("GATE", ip, null, false);
    return { error: "Vale parool." };
  }
  (await cookies()).set(GATE_COOKIE, await gateToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  const next = String(formData.get("next") ?? "/");
  redirect(/^\/(?![\/\\])[^\s\\]*$/.test(next) ? next : "/");
}
