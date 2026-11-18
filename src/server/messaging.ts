import "server-only";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { smsSegments } from "@/lib/notifications";

/**
 * Kirjade ja SMS-ide saatmine.
 * - E-post: Resend (RESEND_API_KEY, EMAIL_FROM). Ilma võtmeta salvestatakse kiri ainult logisse ("dev-log").
 * - SMS: Messente (MESSENTE_API_USERNAME, MESSENTE_API_PASSWORD). Ilma võtmeteta SMS-e ei saadeta.
 */

export const emailConfigured = () => !!process.env.RESEND_API_KEY;
export const smsConfigured = () => !!(process.env.MESSENTE_API_USERNAME && process.env.MESSENTE_API_PASSWORD);

type Base = { businessId: string; bookingId?: string | null; kind: string; dedupeKey?: string | null };
export type EmailMsg = Base & { to: string; subject: string; text: string; html: string; fromName: string; replyTo?: string | null };
export type SmsMsg = Base & { to: string; text: string; sender: string };

/** Lisa rida logisse; kui dedupeKey on juba olemas, tagasta null (ei saada teist korda) */
async function record(m: Base & { channel: "EMAIL" | "SMS"; to: string; subject?: string | null; body: string; segments?: number }) {
  const [row] = await db
    .insert(s.outboundMessages)
    .values({ businessId: m.businessId, bookingId: m.bookingId ?? null, kind: m.kind, channel: m.channel, to: m.to, subject: m.subject ?? null, body: m.body, segments: m.segments, dedupeKey: m.dedupeKey ?? null })
    .onConflictDoNothing()
    .returning({ id: s.outboundMessages.id });
  return row?.id ?? null;
}

async function finish(id: string, r: { status: "SENT" | "FAILED" | "SKIPPED"; provider?: string; providerId?: string | null; error?: string | null }) {
  await db
    .update(s.outboundMessages)
    .set({ status: r.status, provider: r.provider ?? null, providerId: r.providerId ?? null, error: r.error ?? null, sentAt: r.status === "SENT" ? new Date() : null })
    .where(eq(s.outboundMessages.id, id));
}

export async function sendEmail(m: EmailMsg): Promise<void> {
  const id = await record({ ...m, channel: "EMAIL", subject: m.subject, body: m.text });
  if (!id) return;
  const key = process.env.RESEND_API_KEY;
  if (!key) return finish(id, { status: "SENT", provider: "dev-log" });
  const fromAddr = process.env.EMAIL_FROM ?? "broneeringud@aegly.ee";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${m.fromName.replace(/[<>"]/g, "")} <${fromAddr}>`,
        to: [m.to],
        subject: m.subject,
        html: m.html,
        text: m.text,
        ...(m.replyTo ? { reply_to: m.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (res.ok) await finish(id, { status: "SENT", provider: "resend", providerId: json.id ?? null });
    else await finish(id, { status: "FAILED", provider: "resend", error: json.message ?? `HTTP ${res.status}` });
  } catch (e) {
    await finish(id, { status: "FAILED", provider: "resend", error: e instanceof Error ? e.message : String(e) });
  }
}

export async function sendSms(m: SmsMsg): Promise<void> {
  const id = await record({ ...m, channel: "SMS", body: m.text, segments: smsSegments(m.text).segments });
  if (!id) return;
  if (!smsConfigured()) return finish(id, { status: "SKIPPED", provider: "dev-log", error: "SMS-teenus pole seadistatud" });
  const auth = Buffer.from(`${process.env.MESSENTE_API_USERNAME}:${process.env.MESSENTE_API_PASSWORD}`).toString("base64");
  try {
    const res = await fetch("https://api.messente.com/v1/omnimessage", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: m.to, messages: [{ channel: "sms", sender: m.sender, text: m.text }] }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { omnimessage_id?: string; errors?: { detail?: string }[] };
    if (res.ok) await finish(id, { status: "SENT", provider: "messente", providerId: json.omnimessage_id ?? null });
    else await finish(id, { status: "FAILED", provider: "messente", error: json.errors?.[0]?.detail ?? `HTTP ${res.status}` });
  } catch (e) {
    await finish(id, { status: "FAILED", provider: "messente", error: e instanceof Error ? e.message : String(e) });
  }
}
