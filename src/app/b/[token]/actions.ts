"use server";

import { after } from "next/server";
import { appUrl } from "@/lib/app-url";
import { notifyBooking, notifySalon, notifyWaitlist } from "@/server/notify";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelManaged, rescheduleManaged } from "@/server/manage";

export async function reschedule(token: string, date: string, time: string) {
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(date);
  const t = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).safeParse(time);
  if (!d.success || !t.success) return { ok: false as const, reason: "Vigane aeg" };
  const r = await rescheduleManaged(token, d.data, t.data);
  if (r.ok) {
    const base = await appUrl();
    after(() => Promise.all([notifyBooking(r.bookingId, "CHANGED", base), notifySalon(r.bookingId, "CHANGED", base)]));
    revalidatePath(`/b/${token}`);
  }
  return r;
}

export async function cancel(token: string, reason: string | null) {
  const r = await cancelManaged(token, reason ? reason.slice(0, 200) : null);
  if (r.ok) {
    const base = await appUrl();
    after(async () => {
      await Promise.all([notifyBooking(r.bookingId, "CANCELLED", base), notifySalon(r.bookingId, "CANCELLED", base)]);
      await notifyWaitlist(r.bookingId, base);
    });
    revalidatePath(`/b/${token}`);
  }
  return r;
}
