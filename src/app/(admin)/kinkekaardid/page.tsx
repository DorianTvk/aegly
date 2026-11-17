import type { Metadata } from "next";
import { Suspense } from "react";
import { desc, eq } from "drizzle-orm";
import { CalendarClock, Euro, Percent, Wallet } from "lucide-react";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { formatEuro, formatShortDate, localDate, todayIso, zonedDateTime } from "@/lib/time";
import { Card, Delta, PageHeader } from "@/components/ui/primitives";
import { GiftCardsView, type GiftRow } from "./GiftCardsView";

export const metadata: Metadata = { title: "Kinkekaardid" };

function Stat({ label, value, delta, icon: Icon }: { label: string; value: string; delta?: string; icon: typeof Euro }) {
  return (
    <Card className="flex items-start justify-between p-5">
      <div>
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="mt-3 flex items-center gap-2 text-[26px] font-bold tracking-[-0.5px]">
          {value} {delta && <Delta value={delta} />}
        </p>
      </div>
      <span className="grid size-8 place-items-center rounded-lg bg-lime-soft">
        <Icon size={16} />
      </span>
    </Card>
  );
}

async function GiftCards() {
  const business = await getCurrentBusiness();
  const tz = business.timezone;
  const today = todayIso(tz);
  const now = new Date();
  const monthStart = zonedDateTime(today.slice(0, 8) + "01", "00:00", tz);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

  const cards = await db.query.giftCards.findMany({ where: eq(s.giftCards.businessId, business.id), orderBy: [desc(s.giftCards.createdAt)] });

  const rows: GiftRow[] = cards.map((g) => {
    const daysLeft = Math.ceil((g.expiresAt.getTime() - now.getTime()) / 86_400_000);
    const status: GiftRow["status"] = g.balanceCents === 0 ? "USED" : g.expiresAt < now ? "EXPIRED" : daysLeft <= 30 ? "EXPIRING" : "ACTIVE";
    return {
      id: g.id,
      code: g.code,
      buyer: g.buyerName || (g.source === "ADMIN" ? "Kohapeal" : "—"),
      recipient: g.recipientName || "—",
      valueCents: g.valueCents,
      balanceCents: g.balanceCents,
      expires: formatShortDate(localDate(g.expiresAt, tz)),
      status,
      daysLeft,
    };
  });

  const soldThisMonth = cards.filter((g) => g.createdAt >= monthStart).reduce((a, g) => a + g.valueCents, 0);
  const soldPrevMonth = cards.filter((g) => g.createdAt >= prevMonthStart && g.createdAt < monthStart).reduce((a, g) => a + g.valueCents, 0);
  const live = cards.filter((g) => g.expiresAt >= now);
  const unused = live.reduce((a, g) => a + g.balanceCents, 0);
  const totalValue = cards.reduce((a, g) => a + g.valueCents, 0);
  const usedValue = cards.reduce((a, g) => a + (g.valueCents - g.balanceCents), 0);
  const delta = soldPrevMonth ? `${soldThisMonth >= soldPrevMonth ? "+" : "−"}${Math.abs(Math.round(((soldThisMonth - soldPrevMonth) / soldPrevMonth) * 100))}%` : undefined;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Müüdud sel kuul" value={formatEuro(soldThisMonth, { decimals: false })} delta={delta} icon={Euro} />
        <Stat label="Kasutamata saldo" value={formatEuro(unused, { decimals: false })} icon={Wallet} />
        <Stat label="Kasutusmäär" value={totalValue ? `${Math.round((usedValue / totalValue) * 100)}%` : "—"} icon={Percent} />
        <Stat label="Aegub 30 päeva jooksul" value={String(rows.filter((r) => r.status === "EXPIRING").length)} icon={CalendarClock} />
      </div>
      <GiftCardsView
        cards={rows}
        businessName={business.name}
        settings={{
          giftCardsEnabled: business.giftCardsEnabled,
          giftCardAmounts: business.giftCardAmounts,
          giftCardCustomAmount: business.giftCardCustomAmount,
          giftCardMinCents: business.giftCardMinCents,
          giftCardValidityMonths: business.giftCardValidityMonths,
        }}
      />
    </div>
  );
}

export default function GiftCardsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Kinkekaardid" subtitle="Müü kinkekaarte vidinas ja kohapeal. Kinkekaarti saab kasutada broneeringu ja paketi eest tasumisel." />
      <Suspense fallback={<Card className="h-[480px] animate-pulse" />}>
        <GiftCards />
      </Suspense>
    </div>
  );
}
