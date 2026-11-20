"use server";

import { logActivity } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireManager, requireSession } from "@/lib/session";
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
    await logActivity({ action: "client.updated", summary: `Muutis kliendi ${d.name} andmeid`, target: { type: "client", id } });
    return { ok: true, message: "Salvestatud.", id };
  }
  const [c] = await db.insert(s.clients).values({ ...d, businessId: business.id, consentTermsAt: new Date() }).returning({ id: s.clients.id });
  revalidatePath("/kliendid");
  await logActivity({ action: "client.created", summary: `Lisas kliendi ${d.name}`, target: { type: "client", id: c.id } });
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
  const { business } = await requireManager();
  const c = await own(business.id, clientId);
  await logActivity({ action: "client.noshow_exempt", summary: `${exempt ? "Vabastas" : "Eemaldas vabastuse:"} kliendi ${c.name} ettemaksu nõudest`, target: { type: "client", id: clientId } });
  await db.update(s.clients).set({ noShowExempt: exempt }).where(eq(s.clients.id, clientId));
  revalidatePath(`/kliendid/${clientId}`);
}

/**
 * GDPR: kliendi kustutamine. Kui broneeringuid on (raamatupidamine), isikuandmed anonüümitakse;
 * muidu kustutatakse kirje täielikult.
 */
export async function deleteClient(clientId: string) {
  const { business } = await requireManager();
  const c = await own(business.id, clientId);
  const used = await db.$count(s.bookings, eq(s.bookings.clientId, clientId));
  await logActivity({ action: "client.deleted", summary: `Kustutas kliendi isikuandmed${used > 0 ? " (broneeringud jäid anonüümselt alles)" : ""}`, target: { type: "client", id: clientId } });
  // isikuandmed ka mujalt: saadetud teadete sisu, broneeringute märkused, ootenimekiri, kinkekaartide/ostude nimed
  const email = c.email?.toLowerCase() ?? null;
  const bookingIds = (await db.select({ id: s.bookings.id }).from(s.bookings).where(eq(s.bookings.clientId, clientId))).map((r) => r.id);
  await db.transaction(async (tx) => {
    const msgWho = or(
      bookingIds.length ? inArray(s.outboundMessages.bookingId, bookingIds) : undefined,
      email ? sql`lower(${s.outboundMessages.to}) = ${email}` : undefined,
      c.phone ? eq(s.outboundMessages.to, c.phone) : undefined,
    );
    if (msgWho) await tx.update(s.outboundMessages).set({ to: "kustutatud", subject: null, body: "[kustutatud]" }).where(and(eq(s.outboundMessages.businessId, business.id), msgWho));
    await tx.delete(s.waitlistEntries).where(eq(s.waitlistEntries.clientId, clientId));
    // tegevuste logis nimi → "kustutatud klient"
    if (c.name.length >= 2) {
      await tx
        .update(s.auditLog)
        .set({ summary: sql`replace(${s.auditLog.summary}, ${c.name}, 'kustutatud klient')` })
        .where(and(eq(s.auditLog.businessId, business.id), sql`position(${c.name} in ${s.auditLog.summary}) > 0`));
    }
    if (bookingIds.length) await tx.update(s.bookings).set({ note: null, cancelReason: sql`case when ${s.bookings.cancelReason} is null then null else 'Tühistatud' end` }).where(inArray(s.bookings.id, bookingIds));
    if (email) {
      await tx.update(s.giftCards).set({ recipientName: null, recipientEmail: null, message: null }).where(and(eq(s.giftCards.businessId, business.id), sql`lower(${s.giftCards.recipientEmail}) = ${email}`));
      await tx.update(s.giftCards).set({ buyerName: null, buyerEmail: null }).where(and(eq(s.giftCards.businessId, business.id), sql`lower(${s.giftCards.buyerEmail}) = ${email}`));
      await tx.update(s.shopOrders).set({ buyerName: "Kustutatud", buyerEmail: "kustutatud", buyerPhone: null, data: {} }).where(and(eq(s.shopOrders.businessId, business.id), sql`lower(${s.shopOrders.buyerEmail}) = ${email}`));
    }
    if (used > 0) {
      await tx
        .update(s.clients)
        .set({ name: "Kustutatud klient", email: null, phone: null, birthday: null, notes: [], consentSms: false, consentMarketing: false, tags: [] })
        .where(eq(s.clients.id, clientId));
    } else {
      await tx.delete(s.clients).where(eq(s.clients.id, clientId));
    }
  });
  revalidatePath("/kliendid");
  redirect("/kliendid");
}

/** Müü kliendile pakett kohapeal (sularaha/kaart letis) */
export async function sellPackageToClient(clientId: string, packageId: string, paymentMethod: "kaart" | "sularaha" | "ülekanne"): Promise<FormState> {
  const { business } = await requireManager();
  const c = await own(business.id, clientId);
  const p = await db.query.packages.findFirst({ where: and(eq(s.packages.id, packageId), eq(s.packages.businessId, business.id), eq(s.packages.active, true)) });
  if (!p) return { message: "Paketti ei leitud" };
  const items = await db.query.packageItems.findMany({ where: eq(s.packageItems.packageId, p.id) });
  const uses = items.reduce((n, i) => n + i.quantity, 0);
  if (!uses) return { message: "Paketis pole teenuseid" };
  const expiresAt = p.validityDays ? new Date(Date.now() + p.validityDays * 86_400_000) : null;
  await db.insert(s.clientPackages).values({ clientId: c.id, packageId: p.id, usesTotal: uses, usesLeft: uses, expiresAt });
  await logActivity({ action: "package.sold", summary: `Müüs kliendile ${c.name} paketi ${p.name} (${(p.priceCents / 100).toFixed(2)} €, ${paymentMethod})`, target: { type: "client", id: c.id } });
  revalidatePath(`/kliendid/${clientId}`);
  return { ok: true, message: `Pakett „${p.name}“ lisatud.` };
}

/** Paketi kordade käsitsi parandus (nt vana paberkaardi pealt üle toomine) */
export async function adjustPackageUses(clientId: string, clientPackageId: string, delta: 1 | -1): Promise<FormState> {
  const { business } = await requireManager();
  const c = await own(business.id, clientId);
  const cp = await db.query.clientPackages.findFirst({ where: and(eq(s.clientPackages.id, clientPackageId), eq(s.clientPackages.clientId, c.id)), with: { package: true } });
  if (!cp) return { message: "Paketti ei leitud" };
  const next = cp.usesLeft + delta;
  if (next < 0 || next > cp.usesTotal) return { message: "Kordade arv on piiri peal" };
  await db.update(s.clientPackages).set({ usesLeft: next }).where(eq(s.clientPackages.id, cp.id));
  await logActivity({ action: "package.adjusted", summary: `${delta < 0 ? "Märkis kasutatuks" : "Tagastas"} kliendi ${c.name} paketist „${cp.package.name}“ ühe korra (jääb ${next})`, target: { type: "client", id: c.id } });
  revalidatePath(`/kliendid/${clientId}`);
  return { ok: true };
}
