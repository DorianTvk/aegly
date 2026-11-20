"use server";

import { logActivity } from "@/server/audit";
import { reportError } from "@/lib/report";

import { after } from "next/server";
import { appUrl } from "@/lib/app-url";
import { notifyBooking, notifySalon, notifyWaitlist } from "@/server/notify";
import { recordActivity } from "@/server/activity";
import { canTakeDeposits, createDepositCheckout, refundBooking } from "@/server/stripe";
import { loadManaged } from "@/server/manage";
import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { cancelManaged, rescheduleManaged } from "@/server/manage";

export async function reschedule(token: string, date: string, time: string) {
  const d = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(date);
  const t = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).safeParse(time);
  if (!d.success || !t.success) return { ok: false as const, reason: "Vigane aeg" };
  const r = await rescheduleManaged(token, d.data, t.data);
  if (r.ok) {
    await logActivity({ action: "booking.moved", summary: `Klient muutis broneeringu aega: ${d.data} ${t.data}`, businessId: r.businessId, actor: { name: "Klient (broneeringu link)" }, target: { type: "booking", id: r.bookingId } });
    const base = await appUrl();
    after(() =>
      Promise.all([notifyBooking(r.bookingId, "CHANGED", base), notifySalon(r.bookingId, "CHANGED", base), recordActivity(r.businessId, "BOOKING_CHANGED", { bookingId: r.bookingId })]),
    );
    revalidatePath(`/b/${token}`);
  }
  return r;
}

export async function cancel(token: string, reason: string | null) {
  const r = await cancelManaged(token, reason ? reason.slice(0, 200) : null);
  if (r.ok) {
    await logActivity({ action: "booking.cancelled", summary: `Klient tühistas broneeringu${reason ? ` (${reason.slice(0, 100)})` : ""}`, businessId: r.businessId, actor: { name: "Klient (broneeringu link)" }, target: { type: "booking", id: r.bookingId } });
    const base = await appUrl();
    after(async () => {
      // ettemaks tagasi (tasuta tühistamise aja sees)
      await refundBooking(r.bookingId, "Klient tühistas").catch((e) => reportError("stripe refund", e));
      await Promise.all([
        notifyBooking(r.bookingId, "CANCELLED", base),
        notifySalon(r.bookingId, "CANCELLED", base),
        recordActivity(r.businessId, "BOOKING_CANCELLED", { bookingId: r.bookingId }),
      ]);
      await notifyWaitlist(r.bookingId, base);
    });
    revalidatePath(`/b/${token}`);
  }
  return r;
}

/** Maksa ettemaks uuesti (kui klient katkestas makse või see aegus enne kinnitamist) */
export async function payDeposit(token: string) {
  const m = await loadManaged(token);
  if (!m) return { ok: false as const, reason: "Broneeringut ei leitud" };
  const b = m.booking;
  if (b.status !== "PENDING_PAYMENT" || b.depositCents <= 0 || m.paidCents > 0 || !canTakeDeposits(m.business)) {
    return { ok: false as const, reason: "Ettemaksu ei saa praegu tasuda." };
  }
  let url: string;
  try {
    url = await createDepositCheckout(b.id, await appUrl());
  } catch (e) {
    reportError("stripe checkout", e);
    return { ok: false as const, reason: "Makse alustamine ebaõnnestus. Proovi uuesti." };
  }
  redirect(url);
}
