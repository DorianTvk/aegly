import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarClock, TrendingUp, UserRound, UserX } from "lucide-react";
import { getCurrentBusiness } from "@/lib/tenant";
import { listClients } from "@/server/clients";
import { formatEuro, formatShortDate, localDate, todayIso } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ClientsView, type ClientListItem } from "./ClientsView";

export const metadata: Metadata = { title: "Kliendid" };

const MONTHS_IN = ["jaanuaris", "veebruaris", "märtsis", "aprillis", "mais", "juunis", "juulis", "augustis", "septembris", "oktoobris", "novembris", "detsembris"];

function Stat({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: typeof TrendingUp }) {
  return (
    <Card className="flex items-start justify-between p-5">
      <div>
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <p className="mt-3 text-[26px] font-bold tracking-[-0.5px]">
          {value} {sub && <span className="text-sm font-medium text-muted">{sub}</span>}
        </p>
      </div>
      <span className="grid size-8 place-items-center rounded-lg bg-lime-soft">
        <Icon size={16} />
      </span>
    </Card>
  );
}

async function Clients() {
  const business = await getCurrentBusiness();
  const tz = business.timezone;
  const today = todayIso(tz);
  const month = Number(today.slice(5, 7));
  const monthStart = today.slice(0, 8) + "01";
  const rows = await listClients(business.id);

  const items: ClientListItem[] = rows.map((c) => {
    const tags: ClientListItem["tags"] = [];
    if (c.visits === 0 && !c.tags.includes("VIP")) tags.push({ label: "Uus klient", tone: "info" });
    if (c.tags.includes("VIP")) tags.push({ label: "VIP", tone: "lime" });
    else if (c.visits >= 3) tags.push({ label: "Püsiklient", tone: "lime" });
    if (c.packageTotal > 0) tags.push({ label: `Pakett ${c.packageLeft}/${c.packageTotal}`, tone: "neutral" });
    if (c.giftBalanceCents > 0) tags.push({ label: `Kinkekaart ${formatEuro(c.giftBalanceCents)}`, tone: "neutral" });
    if (c.noShows > 0) tags.push({ label: `Ei ilmunud ${c.noShows}×`, tone: "bad" });
    if (c.cancellations > 0) tags.push({ label: `Tühistas ${c.cancellations}×`, tone: "warn" });
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      visits: c.visits,
      lastVisit: c.lastVisit ? formatShortDate(localDate(c.lastVisit, tz)) : null,
      nextVisit: c.nextVisit ? formatShortDate(localDate(c.nextVisit, tz)).slice(0, 5) : null,
      spent: formatEuro(c.spentCents, { decimals: true }),
      balance: c.packageLeft || c.giftBalanceCents ? [c.packageLeft ? `${c.packageLeft} korda` : null, c.giftBalanceCents ? formatEuro(c.giftBalanceCents) : null].filter(Boolean).join(" · ") : null,
      tags,
      isNew: localDate(c.createdAt, tz) >= monthStart || c.visits === 0,
      isRegular: c.visits >= 3,
      hasBalance: c.packageLeft > 0 || c.giftBalanceCents > 0,
      noShow90: c.noShows90 > 0,
      birthdayThisMonth: !!c.birthday && Number(c.birthday.slice(5, 7)) === month,
    };
  });

  const regulars = items.filter((c) => c.isRegular).length;
  const newThisMonth = rows.filter((c) => localDate(c.createdAt, tz) >= monthStart).length;
  // keskmine päevade vahe kahe järjestikuse külastuse vahel
  const gaps = rows
    .filter((c) => c.visits >= 2 && c.lastVisit && c.firstVisit)
    .map((c) => (c.lastVisit!.getTime() - c.firstVisit!.getTime()) / 86_400_000 / (c.visits - 1))
    .filter((g) => g > 0);
  const avgGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

  return (
    <div className="space-y-5">
      <p className="-mt-3 text-sm text-muted">
        {rows.length} klienti · {newThisMonth} uut sel kuul. Klient lisandub automaatselt esimese broneeringuga.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Kliente kokku" value={String(rows.length)} icon={UserRound} />
        <Stat label="Püsikliendid (3+ külastust)" value={String(regulars)} icon={TrendingUp} />
        <Stat label="Keskmine külastuste vahe" value={avgGap ? `${avgGap} päeva` : "—"} icon={CalendarClock} />
        <Stat label="Ei ilmunud (90 päeva)" value={String(rows.filter((c) => c.noShows90 > 0).length)} icon={UserX} />
      </div>
      <ClientsView clients={items} monthName={MONTHS_IN[month - 1]} />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Kliendid" />
      <Suspense fallback={<Card className="h-[480px] animate-pulse" />}>
        <Clients />
      </Suspense>
    </div>
  );
}
