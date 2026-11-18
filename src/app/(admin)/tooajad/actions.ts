"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager } from "@/lib/session";
import { getSlots } from "@/server/availability";
import { fromMinutes, toMinutes } from "@/lib/time";
import type { FormState } from "@/components/ui/form";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const settingsSchema = z.object({
  hours: z
    .array(z.object({ weekday: z.number().int().min(1).max(7), open: z.boolean(), start: z.string().regex(timeRe), end: z.string().regex(timeRe) }))
    .length(7),
  slotStepMinutes: z.number().int().refine((v) => [0, 10, 15, 30, 60].includes(v)),
  slotMode: z.enum(["ALL", "OPTIMIZED"]),
  minLeadMinutes: z.number().int().min(0).max(20160),
  maxAdvanceDays: z.number().int().min(1).max(730),
  cancelUntilHours: z.number().int().min(0).max(336),
  autoConfirm: z.boolean(),
  useNationalHolidays: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export async function saveScheduleSettings(input: SettingsInput): Promise<FormState> {
  const { business } = await requireManager();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { message: "Kontrolli välju." };
  const d = parsed.data;
  for (const h of d.hours) {
    if (h.open && toMinutes(h.start) >= toMinutes(h.end)) return { message: "Lahtiolekuaja algus peab olema enne lõppu." };
  }
  await db.transaction(async (tx) => {
    for (const h of d.hours) {
      await tx
        .insert(s.openingHours)
        .values({ businessId: business.id, weekday: h.weekday, closed: !h.open, startTime: h.start, endTime: h.end })
        .onConflictDoUpdate({
          target: [s.openingHours.businessId, s.openingHours.weekday],
          set: { closed: !h.open, startTime: h.start, endTime: h.end },
        });
    }
    await tx
      .update(s.businesses)
      .set({
        slotStepMinutes: d.slotStepMinutes,
        slotMode: d.slotMode,
        minLeadMinutes: d.minLeadMinutes,
        maxAdvanceDays: d.maxAdvanceDays,
        cancelUntilHours: d.cancelUntilHours,
        autoConfirm: d.autoConfirm,
        useNationalHolidays: d.useNationalHolidays,
      })
      .where(eq(s.businesses.id, business.id));
  });
  revalidatePath("/tooajad");
  revalidatePath("/kalender");
  return { ok: true, message: "Salvestatud." };
}

const holidaySchema = z
  .object({
    date: z.iso.date("Vali kuupäev"),
    name: z.string().trim().min(2, "Sisesta nimetus").max(60),
    mode: z.enum(["closed", "short"]),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  })
  .refine((d) => d.mode === "closed" || (d.startTime && d.endTime && timeRe.test(d.startTime) && timeRe.test(d.endTime) && d.startTime < d.endTime), {
    path: ["endTime"],
    message: "Sisesta kellaajad",
  });

export async function addHoliday(_prev: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireManager();
  const parsed = holidaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  await db.delete(s.holidays).where(and(eq(s.holidays.businessId, business.id), eq(s.holidays.date, d.date)));
  await db.insert(s.holidays).values({
    businessId: business.id,
    date: d.date,
    name: d.name,
    closed: d.mode === "closed",
    startTime: d.mode === "short" ? d.startTime : null,
    endTime: d.mode === "short" ? d.endTime : null,
  });
  revalidatePath("/tooajad");
  revalidatePath("/kalender");
  return { ok: true, message: "Erand lisatud." };
}

export async function deleteHoliday(id: string) {
  const { business } = await requireManager();
  await db.delete(s.holidays).where(and(eq(s.holidays.id, id), eq(s.holidays.businessId, business.id)));
  revalidatePath("/tooajad");
  revalidatePath("/kalender");
}

/** Eelvaade: täpselt need ajad, mida vidin kliendile näitaks */
export async function previewSlots(serviceId: string, staffId: string | null, isoDate: string) {
  const { business } = await requireManager();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return { slots: [] as string[], reason: "past" as const };
  const res = await getSlots(business.id, serviceId, staffId, isoDate);
  return { slots: res.slots.map((sl) => fromMinutes(sl.start)), reason: res.reason };
}
