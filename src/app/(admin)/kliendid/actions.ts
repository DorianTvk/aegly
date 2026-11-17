"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import type { FormState } from "@/components/ui/form";

const clientSchema = z.object({
  name: z.string().trim().min(2, "Sisesta nimi").max(80),
  email: z.union([z.literal(""), z.email("Vigane e-post")]).transform((v) => v.toLowerCase() || null),
  phone: z.string().trim().max(30).transform((v) => v || null),
  birthday: z.union([z.literal(""), z.iso.date()]).transform((v) => v || null),
  consentSms: z.boolean(),
  consentMarketing: z.boolean(),
});
export type ClientInput = z.input<typeof clientSchema>;

async function own(businessId: string, id: string) {
  const c = await db.query.clients.findFirst({ where: and(eq(s.clients.id, id), eq(s.clients.businessId, businessId)) });
  if (!c) throw new Error("Klienti ei leitud");
  return c;
}

export async function saveClient(id: string | null, input: ClientInput): Promise<FormState & { id?: string }> {
  const { business } = await requireSession();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Kontrolli välju" };
  const d = parsed.data;
  if (!d.email && !d.phone) return { message: "Sisesta e-post või telefon" };
  if (d.email) {
    const dup = await db.query.clients.findFirst({
      where: and(eq(s.clients.businessId, business.id), sql`lower(${s.clients.email}) = ${d.email}`, id ? ne(s.clients.id, id) : undefined),
    });
    if (dup) return { message: `Selle e-postiga klient on juba olemas: ${dup.name}` };
  }
  if (id) {
    await own(business.id, id);
    await db.update(s.clients).set(d).where(eq(s.clients.id, id));
    revalidatePath(`/kliendid/${id}`);
    revalidatePath("/kliendid");
    return { ok: true, message: "Salvestatud.", id };
  }
  const [c] = await db.insert(s.clients).values({ ...d, businessId: business.id, consentTermsAt: new Date() }).returning({ id: s.clients.id });
  revalidatePath("/kliendid");
  return { ok: true, message: "Klient lisatud.", id: c.id };
}

export async function addNote(clientId: string, text: string): Promise<FormState> {
  const { business, user } = await requireSession();
  const c = await own(business.id, clientId);
  const t = text.trim();
  if (!t) return { message: "Märge on tühi" };
  if (t.length > 500) return { message: "Märge on liiga pikk" };
  await db
    .update(s.clients)
    .set({ notes: [{ text: t, author: user.name, at: new Date().toISOString() }, ...c.notes] })
    .where(eq(s.clients.id, clientId));
  revalidatePath(`/kliendid/${clientId}`);
  return { ok: true };
}

export async function deleteNote(clientId: string, index: number) {
  const { business } = await requireSession();
  const c = await own(business.id, clientId);
  await db.update(s.clients).set({ notes: c.notes.filter((_, i) => i !== index) }).where(eq(s.clients.id, clientId));
  revalidatePath(`/kliendid/${clientId}`);
}

export async function setNoShowExempt(clientId: string, exempt: boolean) {
  const { business } = await requireSession();
  await own(business.id, clientId);
  await db.update(s.clients).set({ noShowExempt: exempt }).where(eq(s.clients.id, clientId));
  revalidatePath(`/kliendid/${clientId}`);
}

/**
 * GDPR: kliendi kustutamine. Kui broneeringuid on (raamatupidamine), isikuandmed anonüümitakse;
 * muidu kustutatakse kirje täielikult.
 */
export async function deleteClient(clientId: string) {
  const { business } = await requireSession();
  await own(business.id, clientId);
  const used = await db.$count(s.bookings, eq(s.bookings.clientId, clientId));
  if (used > 0) {
    await db
      .update(s.clients)
      .set({ name: "Kustutatud klient", email: null, phone: null, birthday: null, notes: [], consentSms: false, consentMarketing: false, tags: [] })
      .where(eq(s.clients.id, clientId));
  } else {
    await db.delete(s.clients).where(eq(s.clients.id, clientId));
  }
  revalidatePath("/kliendid");
  redirect("/kliendid");
}
