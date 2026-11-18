"use server";

import { appUrl } from "@/lib/app-url";
import { requireSession } from "@/lib/session";
import { sendVerifyEmail } from "@/server/auth-tokens";
import { clientIp, recentAttempts, recordAttempt } from "@/server/bot-protection";

export async function resendVerification(): Promise<{ ok: boolean; message: string }> {
  const { user } = await requireSession();
  if (user.emailVerifiedAt) return { ok: true, message: "E-post on juba kinnitatud." };
  if ((await recentAttempts("VERIFY_SEND", { email: user.email }, 60)) >= 3) {
    return { ok: false, message: "Saatsime juba mitu kirja. Proovi tunni aja pärast uuesti." };
  }
  await recordAttempt("VERIFY_SEND", await clientIp(), user.email, true);
  await sendVerifyEmail(user, await appUrl());
  return { ok: true, message: `Saatsime kinnituslingi aadressile ${user.email}.` };
}
