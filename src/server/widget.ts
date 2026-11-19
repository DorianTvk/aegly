import "server-only";
import { canTakeDeposits } from "./stripe";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { addDaysIso, isoWeekday, localDate, todayIso } from "@/lib/time";
import { getSlots } from "./availability";
import { smsConfigured } from "./messaging";

/** Avalik salong slug'i järgi; peatatud tellimusega salongi vidin ei tööta */
export async function findPublicBusiness(slug: string) {
  const b = await db.query.businesses.findFirst({ where: eq(s.businesses.slug, slug) });
  if (!b || b.planStatus === "SUSPENDED") return null;
  return b;
}

export type WidgetService = {
  id: string;
  categoryId: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  priceCents: number;
  priceType: "FIXED" | "FROM" | "FREE" | "HIDDEN";
  showPrice: boolean;
  depositPercent: number;
  allowStaffChoice: boolean;
  /** kampaania hind (kui kampaania kehtib praegu teenusele ilma aja tingimuseta) */
  campaignPriceCents: number | null;
  campaignLabel: string | null;
  staff: { id: string; name: string; title: string | null; color: string; avatarUrl: string | null; priceCents: number; durationMinutes: number; onLeaveUntil: string | null }[];
};

export type WidgetData = Awaited<ReturnType<typeof loadWidget>>;

/** Kõik, mida vidin avamisel vajab (üks päring lehe laadimisel) */
export async function loadWidget(slug: string) {
  const b = await findPublicBusiness(slug);
  if (!b) return null;
  const tz = b.timezone;
  const today = todayIso(tz);
  const now = new Date();

  const [categories, services, links, staff, hours, campaigns, leaves] = await Promise.all([
    db.query.serviceCategories.findMany({ where: eq(s.serviceCategories.businessId, b.id), orderBy: [asc(s.serviceCategories.sortOrder)] }),
    db.query.services.findMany({
      where: and(eq(s.services.businessId, b.id), eq(s.services.status, "ACTIVE"), eq(s.services.bookableOnline, true)),
      orderBy: [asc(s.services.sortOrder), asc(s.services.name)],
    }),
    db.select().from(s.staffServices).innerJoin(s.services, eq(s.services.id, s.staffServices.serviceId)).where(eq(s.services.businessId, b.id)),
    db.query.staffMembers.findMany({
      where: and(eq(s.staffMembers.businessId, b.id), eq(s.staffMembers.active, true), eq(s.staffMembers.bookableOnline, true)),
      orderBy: [asc(s.staffMembers.sortOrder)],
    }),
    db.query.openingHours.findMany({ where: eq(s.openingHours.businessId, b.id) }),
    db.query.campaigns.findMany({ where: and(eq(s.campaigns.businessId, b.id), eq(s.campaigns.active, true), lte(s.campaigns.startsAt, now), gte(s.campaigns.endsAt, now)) }),
    db.query.timeOff.findMany({ where: and(lte(s.timeOff.startsAt, now), gte(s.timeOff.endsAt, now)) }),
  ]);

  const staffById = new Map(staff.map((m) => [m.id, m]));
  // puhkus (viimane puhkusepäev kohalikus ajas)
  const leaveUntil = new Map(
    leaves.filter((l) => staffById.has(l.staffId) && l.type === "VACATION").map((l) => [l.staffId, localDate(new Date(l.endsAt.getTime() - 1), tz)]),
  );

  const out: WidgetService[] = services
    .map((sv) => {
      const svStaff = links
        .filter((l) => l.staff_services.serviceId === sv.id && staffById.has(l.staff_services.staffId))
        .map((l) => {
          const m = staffById.get(l.staff_services.staffId)!;
          return {
            id: m.id, name: m.name, title: m.title, color: m.color, avatarUrl: m.avatarUrl,
            priceCents: l.staff_services.priceCents ?? sv.priceCents,
            durationMinutes: l.staff_services.durationMinutes ?? sv.durationMinutes,
            onLeaveUntil: leaveUntil.get(m.id) ?? null,
          };
        });
      // lihtsustatud kampaaniahind nimekirja jaoks: ainult tingimusteta (kõik päevad/ajad) protsent või summa
      const camp = campaigns.find(
        (c) => !c.weekdays.length && !c.fromTime && !c.toTime && !c.staffIds.length &&
          (c.serviceIds.length + c.categoryIds.length === 0 || c.serviceIds.includes(sv.id) || (sv.categoryId !== null && c.categoryIds.includes(sv.categoryId))),
      );
      let campaignPriceCents: number | null = null;
      if (camp && sv.priceType !== "FREE") {
        campaignPriceCents =
          camp.kind === "PERCENT" ? Math.round((sv.priceCents * (100 - camp.value)) / 100) : camp.kind === "FIXED" ? Math.max(0, sv.priceCents - camp.value) : camp.value;
      }
      return {
        id: sv.id, categoryId: sv.categoryId, name: sv.name, description: sv.description, imageUrl: sv.imageUrl, durationMinutes: sv.durationMinutes,
        priceCents: sv.priceCents, priceType: sv.priceType, showPrice: sv.showPrice && b.widgetShowPrices && sv.priceType !== "HIDDEN",
        depositPercent: sv.depositPercent, allowStaffChoice: sv.allowStaffChoice && b.widgetShowStaff,
        campaignPriceCents, campaignLabel: camp ? (camp.kind === "PERCENT" ? `−${camp.value}%` : camp.name) : null,
        staff: svStaff,
      };
    })
    .filter((sv) => sv.staff.length > 0);

  const todayHours = hours.find((h) => h.weekday === isoWeekday(today));
  const banner = campaigns.find((c) => c.showBanner && c.bannerText);

  return {
    business: {
      slug: b.slug, name: b.name, address: b.address, phone: b.phone, logoUrl: b.widgetShowLogo ? b.logoUrl : null,
      bannerUrl: b.widgetShowBanner ? b.bannerUrl : null, description: b.description, timezone: tz,
      todayHours: todayHours && !todayHours.closed ? `${todayHours.startTime?.slice(0, 2)}–${todayHours.endTime?.slice(0, 2)}` : null,
      cancelUntilHours: b.cancelUntilHours, maxAdvanceDays: b.maxAdvanceDays, noShowProtection: b.noShowProtection,
      smsAvailable: smsConfigured(),
      onlineDeposits: canTakeDeposits(b),
    },
    theme: {
      primary: b.widgetPrimary, buttonText: b.widgetButtonColor, background: b.widgetBackground, text: b.widgetTextColor,
      font: b.widgetFont, dark: b.widgetTheme === "dark", launcherText: b.widgetButtonText,
    },
    banner: b.widgetShowCampaignBanner && banner ? { text: banner.bannerText!, color: banner.bannerColor } : null,
    categories: categories.filter((c) => out.some((sv) => sv.categoryId === c.id)).map((c) => ({ id: c.id, name: c.name })),
    hasUncategorized: out.some((sv) => sv.categoryId === null),
    services: out,
    today,
  };
}

/** Esimene vaba aeg teenusele (töötajale või ükskõik kellele) järgmise `days` päeva jooksul */
export async function firstFree(businessId: string, serviceId: string, staffId: string | null, fromIso: string, days = 21) {
  for (let i = 0; i < days; i++) {
    const date = addDaysIso(fromIso, i);
    const { slots, reason } = await getSlots(businessId, serviceId, staffId, date);
    if (reason === "too-far") return null;
    if (slots.length) return { date, start: slots[0].start };
  }
  return null;
}

/** Nädala päevade staatus aja valiku riba jaoks: kas päeval on vabu aegu */
export async function weekAvailability(businessId: string, serviceId: string, staffId: string | null, fromIso: string, days = 7) {
  const dates = Array.from({ length: days }, (_, i) => addDaysIso(fromIso, i));
  const res = await Promise.all(dates.map((d) => getSlots(businessId, serviceId, staffId, d)));
  return dates.map((date, i) => ({ date, free: res[i].slots.length, reason: res[i].reason ?? null }));
}

