// Aegly – andmemudel
// Põhineb Figma raporti "R1 Süsteemi ülevaade ja andmemudel" objektidel.
// Iga rida kuulub ühele ettevõttele (businessId) – mitme salongi SaaS.

import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "./id";

const id = () => text("id").primaryKey().$defaultFn(createId);
const businessId = () =>
  text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });

// ---------- Enumid ----------

export const roleEnum = pgEnum("role", ["OWNER", "ADMIN", "STAFF"]);
export const timeOffTypeEnum = pgEnum("time_off_type", ["VACATION", "TRAINING", "SICK", "OTHER"]);
export const serviceStatusEnum = pgEnum("service_status", ["ACTIVE", "DRAFT", "ARCHIVED"]);
export const adjustmentKindEnum = pgEnum("adjustment_kind", ["PERCENT", "FIXED", "FIXED_PRICE"]);
export const packageTypeEnum = pgEnum("package_type", ["MULTI_VISIT", "BUNDLE"]);
export const codeKindEnum = pgEnum("code_kind", ["PERCENT", "FIXED", "FREE_SERVICE"]);
export const bookingStatusEnum = pgEnum("booking_status", [
  "HELD", // aeg hoitud makse ajaks
  "PENDING_PAYMENT", // ootab ettemaksu
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);
export const planEnum = pgEnum("plan", ["SOLO", "SALONG", "SUUR"]);
export const planStatusEnum = pgEnum("plan_status", ["ACTIVE", "PAST_DUE", "SUSPENDED"]);
export const priceTypeEnum = pgEnum("price_type", ["FIXED", "FROM", "FREE", "HIDDEN"]);
export const bookingSourceEnum = pgEnum("booking_source", ["WIDGET", "ADMIN"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED"]);

// ---------- Ettevõte ja kasutajad (13 · 08 · 12) ----------

export const businesses = pgTable("businesses", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  registryCode: text("registry_code"),
  vatNumber: text("vat_number"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  timezone: text("timezone").notNull().default("Europe/Tallinn"),
  currency: text("currency").notNull().default("EUR"),
  locale: text("locale").notNull().default("et"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  description: text("description"),
  industry: text("industry"),
  website: text("website"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  logoInEmails: boolean("logo_in_emails").notNull().default(true),
  // Vidina välimus (12)
  widgetPrimary: text("widget_primary").notNull().default("#0f766e"),
  widgetButtonText: text("widget_button_text").notNull().default("Broneeri aeg"),
  widgetTheme: text("widget_theme").notNull().default("light"),
  widgetShowPrices: boolean("widget_show_prices").notNull().default(true),
  widgetShowStaff: boolean("widget_show_staff").notNull().default(true),
  widgetButtonColor: text("widget_button_color").notNull().default("#ffffff"),
  widgetBackground: text("widget_background").notNull().default("#ffffff"),
  widgetTextColor: text("widget_text_color").notNull().default("#1f2a2a"),
  widgetFont: text("widget_font").notNull().default("inherit"),
  widgetShowLogo: boolean("widget_show_logo").notNull().default(true),
  widgetShowBanner: boolean("widget_show_banner").notNull().default(true),
  widgetShowCampaignBanner: boolean("widget_show_campaign_banner").notNull().default(true),
  widgetLanguages: text("widget_languages").array().notNull().default(sql`'{et}'::text[]`),
  widgetEmbed: text("widget_embed").$type<"popup" | "iframe">().notNull().default("popup"),
  /** millal vidina välimust esimest korda salvestati (seadistuse edenemine) */
  widgetCustomizedAt: ts("widget_customized_at"),
  widgetInstalledAt: ts("widget_installed_at"),
  allowedDomains: text("allowed_domains").array().notNull().default(sql`'{}'::text[]`),
  // Broneerimisreeglid (08)
  slotStepMinutes: integer("slot_step_minutes").notNull().default(15), // 0 = teenuse kestus
  slotMode: text("slot_mode").$type<"ALL" | "OPTIMIZED">().notNull().default("ALL"),
  useNationalHolidays: boolean("use_national_holidays").notNull().default(true),
  minLeadMinutes: integer("min_lead_minutes").notNull().default(120),
  maxAdvanceDays: integer("max_advance_days").notNull().default(60),
  cancelUntilHours: integer("cancel_until_hours").notNull().default(24),
  autoConfirm: boolean("auto_confirm").notNull().default(true),
  holdMinutes: integer("hold_minutes").notNull().default(10),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }).notNull().default("24"),
  pricesIncludeVat: boolean("prices_include_vat").notNull().default(true),
  // Mitteilmumise kaitse
  noShowProtection: boolean("no_show_protection").notNull().default(true),
  noShowThreshold: integer("no_show_threshold").notNull().default(2),
  // Teavitused (19)
  emailSenderName: text("email_sender_name"),
  smsSender: text("sms_sender"),
  replyToEmail: text("reply_to_email"),
  googleReviewUrl: text("google_review_url"),
  // Kinkekaardid (17)
  giftCardsEnabled: boolean("gift_cards_enabled").notNull().default(true),
  giftCardAmounts: integer("gift_card_amounts").array().notNull().default(sql`'{2500,5000,7500,10000}'::int[]`),
  giftCardCustomAmount: boolean("gift_card_custom_amount").notNull().default(true),
  giftCardMinCents: integer("gift_card_min_cents").notNull().default(2000),
  giftCardValidityMonths: integer("gift_card_validity_months").notNull().default(12),
  // Aegly tellimus (pakett)
  plan: planEnum("plan").notNull().default("SALONG"),
  billingPeriod: text("billing_period").$type<"MONTH" | "YEAR">().notNull().default("MONTH"),
  planStatus: planStatusEnum("plan_status").notNull().default("ACTIVE"),
  planRenewsAt: ts("plan_renews_at"),
  planChangedAt: ts("plan_changed_at"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  // Stripe Connect
  stripeAccountId: text("stripe_account_id"),
  stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
  stripeDetailsSubmitted: boolean("stripe_details_submitted").notNull().default(false),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    businessId: businessId(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    role: roleEnum("role").notNull().default("OWNER"),
    /** e-posti kinnitamise aeg; null = kinnitamata */
    emailVerifiedAt: ts("email_verified_at"),
    /** töötaja rolli puhul seotud töötaja profiil (näeb ainult oma kalendrit) */
    staffId: text("staff_id"),
    /** millal kasutaja viimati kellukese teavitusi vaatas */
    notificationsSeenAt: ts("notifications_seen_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email").on(t.email)],
);

/** Sisselogimise sessioon; küpsises on token, andmebaasis selle SHA-256 räsi */
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // tokeni räsi
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

/** Üleslaaditud failid (logo, bänner, teenuse pilt). Väikesed failid hoitakse andmebaasis. */
export const files = pgTable("files", {
  id: id(),
  businessId: businessId(),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  data: text("data").notNull(), // base64
  createdAt: createdAt(),
});

// ---------- Töötajad ja ajad (06 · 07 · 08) ----------

export const staffMembers = pgTable("staff_members", {
  id: id(),
  businessId: businessId(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  color: text("color").notNull().default("#7a5af8"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  bookableOnline: boolean("bookable_online").notNull().default(true),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  externalCalendar: text("external_calendar"),
  invitedAt: ts("invited_at"),
  createdAt: createdAt(),
});

export type ScheduleBreak = { start: string; end: string; label?: string };

/** Nädalagraafik, kehtib alates kuupäevast. weekday: 1 = E … 7 = P */
export const workSchedules = pgTable("work_schedules", {
  id: id(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staffMembers.id, { onDelete: "cascade" }),
  validFrom: date("valid_from").notNull(),
  validTo: date("valid_to"),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  breaks: jsonb("breaks").$type<ScheduleBreak[]>().notNull().default([]),
});

export const timeOff = pgTable("time_off", {
  id: id(),
  staffId: text("staff_id")
    .notNull()
    .references(() => staffMembers.id, { onDelete: "cascade" }),
  type: timeOffTypeEnum("type").notNull().default("VACATION"),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  note: text("note"),
});

export const openingHours = pgTable(
  "opening_hours",
  {
    id: id(),
    businessId: businessId(),
    weekday: integer("weekday").notNull(),
    closed: boolean("closed").notNull().default(false),
    startTime: text("start_time"),
    endTime: text("end_time"),
  },
  (t) => [uniqueIndex("opening_hours_business_weekday").on(t.businessId, t.weekday)],
);

export const holidays = pgTable("holidays", {
  id: id(),
  businessId: businessId(),
  date: date("date").notNull(),
  name: text("name").notNull(),
  closed: boolean("closed").notNull().default(true),
  startTime: text("start_time"),
  endTime: text("end_time"),
});

// ---------- Teenused ja hinnad (03 · 04 · 09) ----------

export const serviceCategories = pgTable("service_categories", {
  id: id(),
  businessId: businessId(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#7a5af8"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const services = pgTable("services", {
  id: id(),
  businessId: businessId(),
  categoryId: text("category_id").references(() => serviceCategories.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  durationMinutes: integer("duration_minutes").notNull(),
  bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
  bufferMinutes: integer("buffer_minutes").notNull().default(0),
  priceType: priceTypeEnum("price_type").notNull().default("FIXED"),
  priceCents: integer("price_cents").notNull(),
  depositPercent: integer("deposit_percent").notNull().default(0),
  vatRate: numeric("vat_rate", { precision: 5, scale: 2 }),
  bookableOnline: boolean("bookable_online").notNull().default(true),
  showPrice: boolean("show_price").notNull().default(true),
  allowStaffChoice: boolean("allow_staff_choice").notNull().default(true),
  // tühi = ettevõtte vaikeväärtus (08)
  minLeadMinutes: integer("min_lead_minutes"),
  maxAdvanceDays: integer("max_advance_days"),
  cancelUntilHours: integer("cancel_until_hours"),
  updatedAt: ts("updated_at"),
  updatedBy: text("updated_by"),
  maxParticipants: integer("max_participants").notNull().default(1),
  status: serviceStatusEnum("status").notNull().default("ACTIVE"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/** Töötaja ↔ teenus, valikuline oma hind ja kestus */
export const staffServices = pgTable(
  "staff_services",
  {
    staffId: text("staff_id")
      .notNull()
      .references(() => staffMembers.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents"),
    durationMinutes: integer("duration_minutes"),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })],
);

/** Lisatasu (value > 0) või soodustus (value < 0) tingimusel. FIXED väärtus sentides. */
export const priceRules = pgTable("price_rules", {
  id: id(),
  businessId: businessId(),
  name: text("name").notNull(),
  kind: adjustmentKindEnum("kind").notNull(),
  value: integer("value").notNull(),
  weekdays: integer("weekdays").array().notNull().default(sql`'{}'::int[]`),
  fromTime: text("from_time"),
  toTime: text("to_time"),
  minLeadHours: integer("min_lead_hours"),
  maxLeadHours: integer("max_lead_hours"),
  dateFrom: date("date_from"),
  dateTo: date("date_to"),
  serviceIds: text("service_ids").array().notNull().default(sql`'{}'::text[]`),
  categoryIds: text("category_ids").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ---------- Müük (05 · 10 · 11 · 17) ----------

export const packages = pgTable("packages", {
  id: id(),
  businessId: businessId(),
  type: packageTypeEnum("type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  priceCents: integer("price_cents").notNull(),
  validityDays: integer("validity_days"),
  sellInWidget: boolean("sell_in_widget").notNull().default(true),
  shareable: boolean("shareable").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const packageItems = pgTable(
  "package_items",
  {
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.packageId, t.serviceId] })],
);

/** Kampaania: positiivne value = soodustus (20 = −20 % või 2000 = −20 €) */
export const campaigns = pgTable("campaigns", {
  id: id(),
  businessId: businessId(),
  name: text("name").notNull(),
  kind: adjustmentKindEnum("kind").notNull(),
  value: integer("value").notNull(),
  startsAt: ts("starts_at").notNull(),
  endsAt: ts("ends_at").notNull(),
  weekdays: integer("weekdays").array().notNull().default(sql`'{}'::int[]`),
  fromTime: text("from_time"),
  toTime: text("to_time"),
  serviceIds: text("service_ids").array().notNull().default(sql`'{}'::text[]`),
  categoryIds: text("category_ids").array().notNull().default(sql`'{}'::text[]`),
  staffIds: text("staff_ids").array().notNull().default(sql`'{}'::text[]`),
  combinable: boolean("combinable").notNull().default(false),
  showBanner: boolean("show_banner").notNull().default(false),
  bannerText: text("banner_text"),
  bannerColor: text("banner_color").notNull().default("#fff4ed"),
  packageIds: text("package_ids").array().notNull().default(sql`'{}'::text[]`),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const discountCodes = pgTable(
  "discount_codes",
  {
    id: id(),
    businessId: businessId(),
    code: text("code").notNull(),
    kind: codeKindEnum("kind").notNull(),
    value: integer("value").notNull(),
    minAmountCents: integer("min_amount_cents"),
    startsAt: ts("starts_at"),
    endsAt: ts("ends_at"),
    maxUses: integer("max_uses"),
    maxUsesPerClient: integer("max_uses_per_client"),
    usedCount: integer("used_count").notNull().default(0),
    newClientsOnly: boolean("new_clients_only").notNull().default(false),
    combinable: boolean("combinable").notNull().default(false),
    appliesToPackages: boolean("applies_to_packages").notNull().default(false),
    serviceIds: text("service_ids").array().notNull().default(sql`'{}'::text[]`),
    categoryIds: text("category_ids").array().notNull().default(sql`'{}'::text[]`),
    packageIds: text("package_ids").array().notNull().default(sql`'{}'::text[]`),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("discount_codes_business_code").on(t.businessId, t.code)],
);

export const giftCards = pgTable("gift_cards", {
  id: id(),
  businessId: businessId(),
  code: text("code").notNull().unique(),
  buyerName: text("buyer_name"),
  buyerEmail: text("buyer_email"),
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"),
  message: text("message"),
  valueCents: integer("value_cents").notNull(),
  balanceCents: integer("balance_cents").notNull(),
  expiresAt: ts("expires_at").notNull(),
  sendAt: ts("send_at"),
  source: text("source").$type<"WIDGET" | "ADMIN">().notNull().default("ADMIN"),
  paymentMethod: text("payment_method"),
  createdAt: createdAt(),
});

/** Kinkekaardi kasutamised (saldo muutus) */
export const giftCardRedemptions = pgTable("gift_card_redemptions", {
  id: id(),
  giftCardId: text("gift_card_id")
    .notNull()
    .references(() => giftCards.id, { onDelete: "cascade" }),
  bookingId: text("booking_id").references(() => bookings.id),
  amountCents: integer("amount_cents").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

export const notificationTypeEnum = pgEnum("notification_type", [
  "CONFIRMATION", "REMINDER", "CHANGED", "CANCELLED", "PAYMENT_PENDING", "WAITLIST", "REVIEW", "BIRTHDAY",
]);

/** Teavituse seaded ja mallid; puuduv rida = vaikeväärtus koodis */
export const notificationSettings = pgTable(
  "notification_settings",
  {
    id: id(),
    businessId: businessId(),
    type: notificationTypeEnum("type").notNull(),
    emailEnabled: boolean("email_enabled").notNull(),
    smsEnabled: boolean("sms_enabled").notNull(),
    /** minutid: meeldetuletus = enne algust, arvustus/ettemaks = pärast */
    offsetMinutes: integer("offset_minutes"),
    emailSubject: text("email_subject"),
    emailBody: text("email_body"),
    smsBody: text("sms_body"),
  },
  (t) => [uniqueIndex("notification_settings_business_type").on(t.businessId, t.type)],
);

// ---------- Kliendid ja broneeringud (14 · 15 · 02 · W6–W8) ----------

export type ClientNote = { text: string; author: string; at: string };

export const clients = pgTable(
  "clients",
  {
    id: id(),
    businessId: businessId(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    birthday: date("birthday"),
    notes: jsonb("notes").$type<ClientNote[]>().notNull().default([]),
    consentTermsAt: ts("consent_terms_at"),
    consentSms: boolean("consent_sms").notNull().default(false),
    consentMarketing: boolean("consent_marketing").notNull().default(false),
    noShowExempt: boolean("no_show_exempt").notNull().default(false),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    createdAt: createdAt(),
  },
  (t) => [index("clients_business_email").on(t.businessId, t.email), index("clients_business_phone").on(t.businessId, t.phone)],
);

export const clientPackages = pgTable("client_packages", {
  id: id(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  packageId: text("package_id")
    .notNull()
    .references(() => packages.id),
  usesTotal: integer("uses_total").notNull(),
  usesLeft: integer("uses_left").notNull(),
  expiresAt: ts("expires_at"),
  purchasedAt: createdAt(),
});

export type PriceLine = { label: string; amountCents: number; kind?: string };

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    number: text("number").notNull().unique(),
    businessId: businessId(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    staffId: text("staff_id")
      .notNull()
      .references(() => staffMembers.id),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    status: bookingStatusEnum("status").notNull().default("CONFIRMED"),
    source: bookingSourceEnum("source").notNull().default("WIDGET"),
    holdExpiresAt: ts("hold_expires_at"),
    basePriceCents: integer("base_price_cents").notNull(),
    finalPriceCents: integer("final_price_cents").notNull(),
    depositCents: integer("deposit_cents").notNull().default(0),
    priceBreakdown: jsonb("price_breakdown").$type<PriceLine[]>().notNull().default([]),
    discountCodeId: text("discount_code_id"),
    campaignId: text("campaign_id"),
    clientPackageId: text("client_package_id"),
    note: text("note"),
    cancelReason: text("cancel_reason"),
    cancelledAt: ts("cancelled_at"),
    manageToken: text("manage_token").notNull().unique().$defaultFn(createId),
    createdAt: createdAt(),
  },
  (t) => [index("bookings_business_starts").on(t.businessId, t.startsAt), index("bookings_staff_starts").on(t.staffId, t.startsAt)],
);

export const payments = pgTable("payments", {
  id: id(),
  businessId: businessId(),
  bookingId: text("booking_id").references(() => bookings.id),
  amountCents: integer("amount_cents").notNull(),
  status: paymentStatusEnum("status").notNull().default("PENDING"),
  method: text("method"),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  stripeAccountId: text("stripe_account_id"),
  refundedCents: integer("refunded_cents").notNull().default(0),
  createdAt: createdAt(),
});

export const waitlistEntries = pgTable("waitlist_entries", {
  id: id(),
  businessId: businessId(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  serviceId: text("service_id")
    .notNull()
    .references(() => services.id, { onDelete: "cascade" }),
  staffId: text("staff_id").references(() => staffMembers.id),
  date: date("date").notNull(),
  notifiedAt: ts("notified_at"),
  createdAt: createdAt(),
});

// ---------- Ühekordsed lingid: parooli taastamine, e-posti kinnitamine, kutse ----------

export type InviteData = { businessId: string; email: string; name: string; role: "ADMIN" | "STAFF"; staffId: string | null; invitedBy: string };

export const authTokens = pgTable(
  "auth_tokens",
  {
    /** sha256(token); lingis on token ise */
    id: text("id").primaryKey(),
    /** RESET | VERIFY | INVITE */
    kind: text("kind").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    businessId: text("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    data: jsonb("data").$type<InviteData>(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("auth_tokens_email_kind").on(t.email, t.kind), index("auth_tokens_business_kind").on(t.businessId, t.kind)],
);

// ---------- Tegevuste voog (kellukese teavitused halduspaneelis) ----------

export const activityEvents = pgTable(
  "activity_events",
  {
    id: id(),
    businessId: businessId(),
    /** BOOKING_NEW | BOOKING_CHANGED | BOOKING_CANCELLED | WAITLIST | WIDGET_INSTALLED */
    kind: text("kind").notNull(),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    body: text("body"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_business_created").on(t.businessId, t.createdAt)],
);

// ---------- Sisselogimise kaitse (katsete piiramine) ----------

export const authAttempts = pgTable(
  "auth_attempts",
  {
    id: id(),
    /** LOGIN | REGISTER */
    kind: text("kind").notNull(),
    ip: text("ip").notNull(),
    email: text("email"),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_attempts_ip_created").on(t.ip, t.createdAt), index("auth_attempts_email_created").on(t.email, t.createdAt)],
);

// ---------- Saadetud teavitused (väljuvad kirjad ja SMS-id) ----------

export const messageChannelEnum = pgEnum("message_channel", ["EMAIL", "SMS"]);
export const messageStatusEnum = pgEnum("message_status", ["QUEUED", "SENT", "FAILED", "SKIPPED"]);

export const outboundMessages = pgTable(
  "outbound_messages",
  {
    id: id(),
    businessId: businessId(),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    /** teavituse tüüp (CONFIRMATION, REMINDER, …) või SALON_* salongile saadetud teade */
    kind: text("kind").notNull(),
    channel: messageChannelEnum("channel").notNull(),
    to: text("to").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    status: messageStatusEnum("status").notNull().default("QUEUED"),
    /** resend | messente | dev-log */
    provider: text("provider"),
    providerId: text("provider_id"),
    error: text("error"),
    /** SMS-i osade arv (arveldamiseks) */
    segments: integer("segments"),
    /** topelt saatmise vältimiseks, nt "REMINDER:<bookingId>:EMAIL" */
    dedupeKey: text("dedupe_key"),
    sentAt: ts("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("outbound_messages_dedupe").on(t.dedupeKey), index("outbound_messages_business_created").on(t.businessId, t.createdAt)],
);

// ---------- Seosed ----------

export const businessesRelations = relations(businesses, ({ many }) => ({
  staff: many(staffMembers),
  services: many(services),
  bookings: many(bookings),
}));

export const usersRelations = relations(users, ({ one }) => ({
  business: one(businesses, { fields: [users.businessId], references: [businesses.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const staffRelations = relations(staffMembers, ({ many }) => ({
  schedules: many(workSchedules),
  timeOff: many(timeOff),
  services: many(staffServices),
  bookings: many(bookings),
}));

export const workSchedulesRelations = relations(workSchedules, ({ one }) => ({
  staff: one(staffMembers, { fields: [workSchedules.staffId], references: [staffMembers.id] }),
}));

export const timeOffRelations = relations(timeOff, ({ one }) => ({
  staff: one(staffMembers, { fields: [timeOff.staffId], references: [staffMembers.id] }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  category: one(serviceCategories, { fields: [services.categoryId], references: [serviceCategories.id] }),
  staff: many(staffServices),
}));

export const categoriesRelations = relations(serviceCategories, ({ many }) => ({
  services: many(services),
}));

export const staffServicesRelations = relations(staffServices, ({ one }) => ({
  staff: one(staffMembers, { fields: [staffServices.staffId], references: [staffMembers.id] }),
  service: one(services, { fields: [staffServices.serviceId], references: [services.id] }),
}));

export const packagesRelations = relations(packages, ({ many }) => ({
  items: many(packageItems),
  sold: many(clientPackages),
}));

export const packageItemsRelations = relations(packageItems, ({ one }) => ({
  package: one(packages, { fields: [packageItems.packageId], references: [packages.id] }),
  service: one(services, { fields: [packageItems.serviceId], references: [services.id] }),
}));

export const clientPackagesRelations = relations(clientPackages, ({ one }) => ({
  package: one(packages, { fields: [clientPackages.packageId], references: [packages.id] }),
  client: one(clients, { fields: [clientPackages.clientId], references: [clients.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  client: one(clients, { fields: [bookings.clientId], references: [clients.id] }),
  service: one(services, { fields: [bookings.serviceId], references: [services.id] }),
  staff: one(staffMembers, { fields: [bookings.staffId], references: [staffMembers.id] }),
  payments: many(payments),
}));

export const clientsRelations = relations(clients, ({ many }) => ({
  bookings: many(bookings),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));

// ---------- Pildid (töötajate profiilipildid) ----------
// Väikesed (≤ 256 px webp) pildid andmebaasis; serveeritakse /api/pilt/[id] kaudu pika vahemäluga.

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const images = pgTable("images", {
  id: id(),
  businessId: businessId(),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});
