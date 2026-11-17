"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelManaged, rescheduleManaged } from "@/server/manage";

export async function reschedule(token: string, date: string, time: string) {
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(date);
  const t = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).safeParse(time);
  if (!d.success || !t.success) return { ok: false as const, reason: "Vigane aeg" };
  const r = await rescheduleManaged(token, d.data, t.data);
  if (r.ok) revalidatePath(`/b/${token}`);
  return r;
}

export async function cancel(token: string, reason: string | null) {
  const r = await cancelManaged(token, reason ? reason.slice(0, 200) : null);
  if (r.ok) revalidatePath(`/b/${token}`);
  return r;
}
