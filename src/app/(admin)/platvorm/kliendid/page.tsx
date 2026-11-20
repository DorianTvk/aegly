import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { formatEuro } from "@/lib/time";
import { platformClients } from "@/server/platform";
import { PlatformTable } from "../PlatformTable";

export const metadata: Metadata = { title: "Kliendid · Platvorm" };

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("et-EE", { timeZone: "Europe/Tallinn" }) : "—");

async function Clients() {
  await connection(); // päringuaegsed andmed (kuupäevad, Stripe)
  const clients = await platformClients();
  return (
    <PlatformTable
      rows={clients.map(({ b, owner, staff, bookings30, lastBookingAt, paying, comp, mrrCents }) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        plan: b.plan,
        period: b.billingPeriod,
        status: b.planStatus,
        billing: paying || b.stripeSubscriptionId ? "stripe" : comp ? "comp" : "none",
        mrr: mrrCents ? formatEuro(mrrCents, { decimals: true }) : "—",
        staff,
        bookings30,
        lastBooking: fmt(lastBookingAt),
        owner: owner ? `${owner.name} · ${owner.email}` : "—",
        created: fmt(b.createdAt),
        protected: false,
      }))}
    />
  );
}

export default function ClientsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Kliendid" subtitle="Kõik Aegly kliendid. Vajuta nimele, et näha detaile, muuta paketti või vaadata kliendi vaadet." />
      <Suspense fallback={<Card className="h-[480px] animate-pulse" />}>
        <Clients />
      </Suspense>
    </div>
  );
}
