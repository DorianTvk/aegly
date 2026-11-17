"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { parseEuroToCents } from "@/lib/money";
import type { FormState } from "@/components/ui/form";

const optInt = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v == null || v === "default" ? null : Number(v)), z.number().int().min(min).max(max).nullable());

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Sisesta teenuse nimi").max(80),
  categoryId: z.string().optional().transform((v) => v || null),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  durationMinutes: z.coerce.number({ error: "Sisesta kestus" }).int().min(5, "Vähemalt 5 min").max(720),
  bufferBeforeMinutes: z.coerce.number().int().min(0).max(240).default(0),
  bufferMinutes: z.coerce.number().int().min(0).max(240).default(0),
  priceType: z.enum(["FIXED", "FROM", "FREE", "HIDDEN"]),
  price: z.string().optional(),
  vatRate: z.string().optional().transform((v) => (v && v !== "default" ? v : null)),
  depositPercent: z.coerce.number().int().min(0, "0–100").max(100, "0–100").default(0),
  bookableOnline: z.literal("on").optional(),
  showPrice: z.literal("on").optional(),
  allowStaffChoice: z.literal("on").optional(),
  maxParticipants: z.coerce.number().int().min(1).max(50).default(1),
  minLeadMinutes: optInt(0, 60 * 24 * 14),
  maxAdvanceDays: optInt(1, 730),
  cancelUntilHours: optInt(0, 24 * 14),
});

type StaffLink = { staffId: string; priceCents: number | null; durationMinutes: number | null };

function readStaff(formData: FormData): StaffLink[] {
  return formData
    .getAll("staff")
    .map(String)
    .map((staffId) => {
      const dur = String(formData.get(`staffDuration_${staffId}`) ?? "").trim();
      return {
        staffId,
        priceCents: parseEuroToCents(formData.get(`staffPrice_${staffId}`)),
        durationMinutes: dur ? Number(dur) || null : null,
      };
    });
}

export async function saveService(serviceId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { business, user } = await requireSession();
  const parsed = serviceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { message: "Kontrolli välju.", errors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;

  const priceCents = d.priceType === "FREE" ? 0 : parseEuroToCents(d.price);
  if (priceCents === null) return { message: "Kontrolli välju.", errors: { price: ["Sisesta hind, nt 55,00"] } };

  // kategooria ja töötajad peavad kuuluma samale ettevõttele
  if (d.categoryId) {
    const cat = await db.query.serviceCategories.findFirst({
      where: and(eq(s.serviceCategories.id, d.categoryId), eq(s.serviceCategories.businessId, business.id)),
    });
    if (!cat) return { errors: { categoryId: ["Vigane kategooria"] } };
  }
  const links = readStaff(formData);
  if (links.length) {
    const own = await db
      .select({ id: s.staffMembers.id })
      .from(s.staffMembers)
      .where(and(eq(s.staffMembers.businessId, business.id), inArray(s.staffMembers.id, links.map((l) => l.staffId))));
    if (own.length !== links.length) return { message: "Vigane töötaja." };
  }

  const values = {
    name: d.name,
    categoryId: d.categoryId,
    description: d.description,
    durationMinutes: d.durationMinutes,
    bufferBeforeMinutes: d.bufferBeforeMinutes,
    bufferMinutes: d.bufferMinutes,
    priceType: d.priceType,
    priceCents,
    vatRate: d.vatRate,
    depositPercent: d.priceType === "FREE" ? 0 : d.depositPercent,
    bookableOnline: d.bookableOnline === "on",
    showPrice: d.showPrice === "on",
    allowStaffChoice: d.allowStaffChoice === "on",
    maxParticipants: d.maxParticipants,
    minLeadMinutes: d.minLeadMinutes,
    maxAdvanceDays: d.maxAdvanceDays,
    cancelUntilHours: d.cancelUntilHours,
    updatedAt: new Date(),
    updatedBy: user.name,
  };

  const id = await db.transaction(async (tx) => {
    let id = serviceId;
    if (id) {
      const res = await tx
        .update(s.services)
        .set(values)
        .where(and(eq(s.services.id, id), eq(s.services.businessId, business.id)))
        .returning({ id: s.services.id });
      if (!res.length) throw new Error("Teenust ei leitud");
      await tx.delete(s.staffServices).where(eq(s.staffServices.serviceId, id));
    } else {
      const [row] = await tx.insert(s.services).values({ ...values, businessId: business.id }).returning({ id: s.services.id });
      id = row.id;
    }
    if (links.length) {
      await tx.insert(s.staffServices).values(
        links.map((l) => ({
          serviceId: id!,
          staffId: l.staffId,
          // salvestame ainult siis, kui erineb teenuse omast
          priceCents: l.priceCents !== null && l.priceCents !== priceCents ? l.priceCents : null,
          durationMinutes: l.durationMinutes !== null && l.durationMinutes !== d.durationMinutes ? l.durationMinutes : null,
        })),
      );
    }
    return id!;
  });

  revalidatePath("/teenused");
  if (!serviceId) redirect(`/teenused/${id}`);
  return { ok: true, message: "Muudatused salvestatud." };
}

export async function toggleOnline(serviceId: string, online: boolean) {
  const { business } = await requireSession();
  await db
    .update(s.services)
    .set({ bookableOnline: online })
    .where(and(eq(s.services.id, serviceId), eq(s.services.businessId, business.id)));
  revalidatePath("/teenused");
}

/** Kui teenusel on broneeringuid, arhiveeritakse (ajalugu jääb alles); muidu kustutatakse. */
export async function deleteService(serviceId: string) {
  const { business } = await requireSession();
  const used = await db.$count(s.bookings, and(eq(s.bookings.serviceId, serviceId), eq(s.bookings.businessId, business.id)));
  if (used > 0) {
    await db
      .update(s.services)
      .set({ status: "ARCHIVED", bookableOnline: false })
      .where(and(eq(s.services.id, serviceId), eq(s.services.businessId, business.id)));
  } else {
    await db.delete(s.services).where(and(eq(s.services.id, serviceId), eq(s.services.businessId, business.id)));
  }
  revalidatePath("/teenused");
  redirect("/teenused");
}

const categorySchema = z.object({
  name: z.string().trim().min(2, "Sisesta nimi").max(40),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Vigane värv"),
});

export async function saveCategory(categoryId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const { business } = await requireSession();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: z.flattenError(parsed.error).fieldErrors };
  if (categoryId) {
    await db
      .update(s.serviceCategories)
      .set(parsed.data)
      .where(and(eq(s.serviceCategories.id, categoryId), eq(s.serviceCategories.businessId, business.id)));
  } else {
    const count = await db.$count(s.serviceCategories, eq(s.serviceCategories.businessId, business.id));
    await db.insert(s.serviceCategories).values({ ...parsed.data, businessId: business.id, sortOrder: count + 1 });
  }
  revalidatePath("/teenused");
  return { ok: true, message: categoryId ? "Salvestatud." : "Kategooria lisatud." };
}

export async function deleteCategory(categoryId: string) {
  const { business } = await requireSession();
  await db.delete(s.serviceCategories).where(and(eq(s.serviceCategories.id, categoryId), eq(s.serviceCategories.businessId, business.id)));
  revalidatePath("/teenused");
}
