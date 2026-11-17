import type { Metadata } from "next";
import { Suspense } from "react";
import { and, eq, gte, lte } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { appUrl } from "@/lib/app-url";
import { formatShortDate, localDate } from "@/lib/time";
import { Card } from "@/components/ui/primitives";
import { WidgetSettingsView } from "./WidgetSettingsView";

export const metadata: Metadata = { title: "Broneerimisvidin" };

async function Widget() {
  const b = await getCurrentBusiness();
  const now = new Date();
  const [url, banner] = await Promise.all([
    appUrl(),
    db.query.campaigns.findFirst({
      where: and(eq(s.campaigns.businessId, b.id), eq(s.campaigns.active, true), eq(s.campaigns.showBanner, true), lte(s.campaigns.startsAt, now), gte(s.campaigns.endsAt, now)),
    }),
  ]);
  return (
    <WidgetSettingsView
      appUrl={url}
      installedAt={b.widgetInstalledAt ? formatShortDate(localDate(b.widgetInstalledAt, b.timezone)) : null}
      campaignBanner={banner?.bannerText ?? null}
      business={{ slug: b.slug, name: b.name, address: b.address, logoUrl: b.logoUrl, bannerUrl: b.bannerUrl }}
      initial={{
        widgetPrimary: b.widgetPrimary,
        widgetButtonColor: b.widgetButtonColor,
        widgetBackground: b.widgetBackground,
        widgetTextColor: b.widgetTextColor,
        widgetTheme: b.widgetTheme as "light" | "dark" | "auto",
        widgetFont: b.widgetFont as "inherit" | "Inter" | "system",
        widgetButtonText: b.widgetButtonText,
        widgetShowLogo: b.widgetShowLogo,
        widgetShowBanner: b.widgetShowBanner,
        widgetShowPrices: b.widgetShowPrices,
        widgetShowStaff: b.widgetShowStaff,
        widgetShowCampaignBanner: b.widgetShowCampaignBanner,
        widgetLanguages: b.widgetLanguages as ("et" | "en" | "ru")[],
        widgetEmbed: b.widgetEmbed,
        allowedDomains: b.allowedDomains,
      }}
    />
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={<Card className="h-[600px] animate-pulse" />}>
      <Widget />
    </Suspense>
  );
}
