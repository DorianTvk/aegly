import "server-only";
import { and, asc, eq, gt, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { NOTIFICATIONS, renderTemplate, type NotificationType } from "@/lib/notifications";
import { emailHtml, firstName, normalizePhone, smsSenderName } from "@/lib/messages";
import { formatLongDate, localDate, localTime } from "@/lib/time";
import { sendEmail, sendSms, smsConfigured } from "./messaging";

type Business = typeof s.businesses.$inferSelect;

/** Salongi seaded koos vaikeväärtustega */
export async function notificationSetting(businessId: string, type: NotificationType) {
  const def = NOTIFICATIONS.find((n) => n.type === type)!;
  const row = await db.query.notificationSettings.findFirst({ where: and(eq(s.notificationSettings.businessId, businessId), eq(s.notificationSettings.type, type)) });
  return {
    emailEnabled: row?.emailEnabled ?? def.emailEnabled,
    smsEnabled: row?.smsEnabled ?? def.smsEnabled,
    offsetMinutes: row?.offsetMinutes ?? def.offsetMinutes,
    emailSubject: row?.emailSubject || def.emailSubject,
    emailBody: row?.emailBody || def.emailBody,
    smsBody: row?.smsBody || def.smsBody,
  };
}

const longDate = (iso: string) => formatLongDate(iso).replace(/^\w/, (c) => c.toLowerCase()).replace(/ \d{4}$/, "");

async function deliver(opts: {
  business: Business;
  type: NotificationType;
  bookingId: string | null;
  client: { name: string; email: string | null; phone: string | null; consentSms: boolean };
  vars: Record<string, string>;
  dedupe?: string;
}) {
  const { business: b, type, client } = opts;
  const set = await notificationSetting(b.id, type);
  const vars = { "{eesnimi}": firstName(client.name), "{salong}": b.name, "{aadress}": b.address ?? "", ...opts.vars };
  const tasks: Promise<void>[] = [];
  if (set.emailEnabled && client.email) {
    const text = renderTemplate(set.emailBody, vars);
    tasks.push(
      sendEmail({
        businessId: b.id, bookingId: opts.bookingId, kind: type, dedupeKey: opts.dedupe ? `${opts.dedupe}:EMAIL` : null,
        to: client.email, subject: renderTemplate(set.emailSubject, vars), text,
        html: emailHtml({ body: text, salon: b.name, color: b.widgetPrimary, logoUrl: b.logoInEmails ? b.logoUrl : null }),
        fromName: b.emailSenderName || b.name, replyTo: b.replyToEmail || b.email,
      }),
    );
  }
  // SMS: ainult kui teenus on seadistatud; meeldetuletus/ootenimekiri ainult kliendi nõusolekul
  const phone = normalizePhone(client.phone);
  const needsConsent = type === "REMINDER" || type === "WAITLIST" || type === "REVIEW" || type === "BIRTHDAY";
  if (set.smsEnabled && phone && smsConfigured() && (!needsConsent || client.consentSms)) {
    tasks.push(
      sendSms({
        businessId: b.id, bookingId: opts.bookingId, kind: type, dedupeKey: opts.dedupe ? `${opts.dedupe}:SMS` : null,
        to: phone, text: renderTemplate(set.smsBody, vars), sender: smsSenderName(b.smsSender || b.name),
      }),
    );
  }
  await Promise.all(tasks);
}

async function loadBooking(bookingId: string) {
  const bk = await db.query.bookings.findFirst({ where: eq(s.bookings.id, bookingId), with: { client: true, service: true, staff: true } });
  if (!bk) return null;
  const business = await db.query.businesses.findFirst({ where: eq(s.businesses.id, bk.businessId) });
  return business ? { bk, business } : null;
}

/**
 * Kliendi teavitus broneeringu kohta. `baseUrl` = rakenduse aadress (linkide jaoks).
 * Kinnitus/muudatus/tühistamine saadetakse kohe; meeldetuletuse ja arvustuse saadab ajastatud töö.
 */
export async function notifyBooking(bookingId: string, type: NotificationType, baseUrl: string) {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return;
  const { bk, business: b } = loaded;
  const tz = b.timezone;
  const link =
    type === "CANCELLED" ? `${baseUrl}/w/${b.slug}` : type === "REVIEW" ? (b.googleReviewUrl ?? `${baseUrl}/w/${b.slug}`) : `${baseUrl}/b/${bk.manageToken}`;
  await deliver({
    business: b,
    type,
    bookingId: bk.id,
    client: bk.client,
    vars: {
      "{teenus}": bk.service.name,
      "{töötaja}": bk.staff.name,
      "{kuupäev}": longDate(localDate(bk.startsAt, tz)),
      "{kellaaeg}": localTime(bk.startsAt, tz),
      "{link}": link,
    },
    // muudatusi võib olla mitu, teised tüübid saadetakse üks kord
    dedupe: type === "CHANGED" ? `${type}:${bk.id}:${bk.startsAt.getTime()}` : `${type}:${bk.id}`,
  });
}

const SALON_TEXT = {
  NEW: { subject: "Uus broneering", lead: "Veebist tuli uus broneering." },
  CHANGED: { subject: "Broneeringu aeg muutus", lead: "Klient muutis broneeringu aega." },
  CANCELLED: { subject: "Broneering tühistati", lead: "Klient tühistas broneeringu." },
} as const;

/** Teade salongile (ettevõtte e-postile), kui klient ise midagi teeb */
export async function notifySalon(bookingId: string, event: keyof typeof SALON_TEXT, baseUrl: string) {
  const loaded = await loadBooking(bookingId);
  if (!loaded || !loaded.business.email) return;
  const { bk, business: b } = loaded;
  const t = SALON_TEXT[event];
  const date = longDate(localDate(bk.startsAt, b.timezone));
  const time = localTime(bk.startsAt, b.timezone);
  const text = `${t.lead}\n\n${bk.service.name} · ${bk.staff.name}\n${date} kell ${time}\nKlient: ${bk.client.name}${bk.client.phone ? `, ${bk.client.phone}` : ""}${bk.client.email ? `, ${bk.client.email}` : ""}\nBroneering ${bk.number}${bk.cancelReason && event === "CANCELLED" ? `\nPõhjus: ${bk.cancelReason.replace(/^Klient: /, "")}` : ""}\n\nAva halduspaneelis: ${baseUrl}/broneeringud/${bk.id}`;
  await sendEmail({
    businessId: b.id, bookingId: bk.id, kind: `SALON_${event}`,
    dedupeKey: event === "CHANGED" ? null : `SALON_${event}:${bk.id}`,
    to: b.email!, subject: `${t.subject}: ${bk.service.name} ${date} ${time}`, text,
    html: emailHtml({ body: text, salon: "Aegly", color: "#1f2937", footer: "Selle teate saatis Aegly sinu salongi kontolt." }),
    fromName: "Aegly",
  });
}

/** Aeg vabanes → teavita ootenimekirjas esimest, kes ootab seda päeva ja teenust */
export async function notifyWaitlist(bookingId: string, baseUrl: string) {
  const loaded = await loadBooking(bookingId);
  if (!loaded) return;
  const { bk, business: b } = loaded;
  const date = localDate(bk.startsAt, b.timezone);
  const entry = await db.query.waitlistEntries.findFirst({
    where: and(
      eq(s.waitlistEntries.businessId, b.id),
      eq(s.waitlistEntries.serviceId, bk.serviceId),
      eq(s.waitlistEntries.date, date),
      isNull(s.waitlistEntries.notifiedAt),
      or(isNull(s.waitlistEntries.staffId), eq(s.waitlistEntries.staffId, bk.staffId)),
    ),
    orderBy: [asc(s.waitlistEntries.createdAt)],
  });
  if (!entry) return;
  const client = await db.query.clients.findFirst({ where: eq(s.clients.id, entry.clientId) });
  if (!client) return;
  await db.update(s.waitlistEntries).set({ notifiedAt: new Date() }).where(eq(s.waitlistEntries.id, entry.id));
  await deliver({
    business: b,
    type: "WAITLIST",
    bookingId: null,
    client: { ...client, consentSms: client.consentSms },
    vars: { "{teenus}": bk.service.name, "{töötaja}": bk.staff.name, "{kuupäev}": longDate(date), "{kellaaeg}": localTime(bk.startsAt, b.timezone), "{link}": `${baseUrl}/w/${b.slug}` },
    dedupe: `WAITLIST:${entry.id}`,
  });
}

/**
 * Ajastatud töö (iga 15 min): meeldetuletused ja arvustuse küsimine.
 * Topelt saatmise vältimine käib dedupeKey kaudu, seega võib tööd julgelt mitu korda käivitada.
 */
export async function runScheduledNotifications(baseUrl: string, now = new Date()) {
  let reminders = 0;
  let reviews = 0;
  // meeldetuletused: kinnitatud broneeringud järgmise 48 h jooksul
  const upcoming = await db.query.bookings.findMany({
    where: and(eq(s.bookings.status, "CONFIRMED"), gt(s.bookings.startsAt, now), lte(s.bookings.startsAt, new Date(now.getTime() + 48 * 3_600_000))),
    columns: { id: true, businessId: true, startsAt: true, createdAt: true },
  });
  const offsets = new Map<string, number | null>();
  for (const bk of upcoming) {
    if (!offsets.has(bk.businessId)) offsets.set(bk.businessId, (await notificationSetting(bk.businessId, "REMINDER")).offsetMinutes);
    const offset = (offsets.get(bk.businessId) ?? 1440) * 60_000;
    const sendAt = bk.startsAt.getTime() - offset;
    // broneeritud juba meeldetuletuse aknas → kinnitus piisab
    if (now.getTime() >= sendAt && bk.createdAt.getTime() < sendAt) {
      await notifyBooking(bk.id, "REMINDER", baseUrl);
      reminders++;
    }
  }
  // arvustus: toimunud külastused viimase 2 päeva jooksul
  const done = await db.query.bookings.findMany({
    where: and(inArray(s.bookings.status, ["COMPLETED", "CONFIRMED"]), gte(s.bookings.endsAt, new Date(now.getTime() - 48 * 3_600_000)), lte(s.bookings.endsAt, now)),
    columns: { id: true, businessId: true, endsAt: true },
  });
  const reviewSet = new Map<string, Awaited<ReturnType<typeof notificationSetting>>>();
  for (const bk of done) {
    if (!reviewSet.has(bk.businessId)) reviewSet.set(bk.businessId, await notificationSetting(bk.businessId, "REVIEW"));
    const set = reviewSet.get(bk.businessId)!;
    if (!set.emailEnabled && !set.smsEnabled) continue;
    if (now.getTime() >= bk.endsAt.getTime() + (set.offsetMinutes ?? 120) * 60_000) {
      await notifyBooking(bk.id, "REVIEW", baseUrl);
      reviews++;
    }
  }
  return { reminders, reviews };
}
