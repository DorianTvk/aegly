import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq, gte, inArray, max } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { isSuperadmin, PLANS } from "@/lib/plans";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ManageBusiness } from "./ManageBusiness";

export const metadata: Metadata = { title: "Salongi haldus" };

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireSession()]);
  if (!isSuperadmin(session.user.email)) notFound();
  const b = await db.query.businesses.findFirst({ where: eq(s.businesses.id, id) });
  if (!b) notFound();

  const since30 = daysAgo(30);
  const users = await db.query.users.findMany({ where: eq(s.users.businessId, b.id), orderBy: [desc(s.users.createdAt)] });
  const [[staff], [services], [clients], [bookings], [recent], [lastLogin], [emails]] = await Promise.all([
    db.select({ n: count() }).from(s.staffMembers).where(and(eq(s.staffMembers.businessId, b.id), eq(s.staffMembers.active, true))),
    db.select({ n: count() }).from(s.services).where(eq(s.services.businessId, b.id)),
    db.select({ n: count() }).from(s.clients).where(eq(s.clients.businessId, b.id)),
    db.select({ n: count() }).from(s.bookings).where(eq(s.bookings.businessId, b.id)),
    db.select({ n: count() }).from(s.bookings).where(and(eq(s.bookings.businessId, b.id), gte(s.bookings.createdAt, since30))),
    users.length
      ? db.select({ at: max(s.sessions.createdAt) }).from(s.sessions).where(inArray(s.sessions.userId, users.map((u) => u.id)))
      : Promise.resolve([{ at: null }]),
    db.select({ n: count() }).from(s.outboundMessages).where(and(eq(s.outboundMessages.businessId, b.id), gte(s.outboundMessages.createdAt, since30))),
  ]);
  const fmt = (d: Date | null) => (d ? d.toLocaleString("et-EE", { timeZone: "Europe/Tallinn", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

  return (
    <ManageBusiness
      isOwn={b.id === session.business.id}
      business={{
        id: b.id, name: b.name, slug: b.slug, email: b.email ?? "", phone: b.phone ?? "",
        plan: b.plan, period: b.billingPeriod, status: b.planStatus, created: fmt(b.createdAt),
        widgetInstalled: b.widgetInstalledAt ? fmt(b.widgetInstalledAt) : null, planName: PLANS[b.plan].name,
      }}
      stats={[
        { label: "Aktiivsed töötajad", value: `${staff.n}${PLANS[b.plan].staffLimit !== null ? ` / ${PLANS[b.plan].staffLimit}` : ""}` },
        { label: "Teenused", value: String(services.n) },
        { label: "Kliendid", value: String(clients.n) },
        { label: "Broneeringud kokku", value: String(bookings.n) },
        { label: "Broneeringud 30 päeva", value: String(recent.n) },
        { label: "Teavitusi 30 päeva", value: String(emails.n) },
        { label: "Viimane sisselogimine", value: fmt(lastLogin?.at ?? null) },
        { label: "Vidin paigaldatud", value: b.widgetInstalledAt ? fmt(b.widgetInstalledAt) : "Ei" },
      ]}
      users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, created: fmt(u.createdAt), protected: isSuperadmin(u.email) }))}
    />
  );
}

export default function PlatformBusinessPage(props: PageProps<"/platvorm/[id]">) {
  return (
    <div className="max-w-[1100px] space-y-5">
      <Link href="/platvorm" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={15} aria-hidden /> Kõik salongid
      </Link>
      <Suspense fallback={<><PageHeader title="Salongi haldus" /><Card className="h-[480px] animate-pulse" /></>}>
        <Detail params={props.params} />
      </Suspense>
    </div>
  );
}
