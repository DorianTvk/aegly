import type { Metadata } from "next";
import { Suspense } from "react";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { formatLongDate, todayIso } from "@/lib/time";
import { Card, PageHeader } from "@/components/ui/primitives";
import { ManualBookingForm } from "./ManualBookingForm";

export const metadata: Metadata = { title: "Uus broneering" };

type SP = { date?: string; staff?: string; time?: string; client?: string; service?: string };

async function NewBooking({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { business, user } = await requireSession();
  const staffOnly = user.role === "STAFF" ? user.staffId : undefined;
  const today = todayIso(business.timezone);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const [services, staff, client] = await Promise.all([
    db.query.services.findMany({
      where: and(eq(s.services.businessId, business.id), sql`${s.services.status} <> 'ARCHIVED'`),
      orderBy: [asc(s.services.sortOrder)],
      with: { staff: true },
    }),
    db.query.staffMembers.findMany({ where: and(eq(s.staffMembers.businessId, business.id), eq(s.staffMembers.active, true)), orderBy: [asc(s.staffMembers.sortOrder)] }).then((list) => (staffOnly === undefined ? list : list.filter((m) => m.id === staffOnly))),
    sp.client ? db.query.clients.findFirst({ where: and(eq(s.clients.id, sp.client), eq(s.clients.businessId, business.id)) }) : Promise.resolve(undefined),
  ]);
  const visits = client ? await db.$count(s.bookings, and(eq(s.bookings.clientId, client.id), eq(s.bookings.status, "COMPLETED"))) : 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Uus broneering" subtitle={formatLongDate(date)} />
      <ManualBookingForm
        services={services.map((x) => ({ id: x.id, name: x.name, durationMinutes: x.durationMinutes, priceCents: x.priceCents, staffIds: x.staff.map((l) => l.staffId) }))}
        staff={staff.map((m) => ({ id: m.id, name: m.name, color: m.color }))}
        initial={{ date, staffId: staffOnly ?? sp.staff ?? null, time: sp.time ?? null, serviceId: sp.service ?? null }}
        initialClient={client ? { id: client.id, name: client.name, email: client.email, phone: client.phone, visits } : null}
      />
    </div>
  );
}

export default function NewBookingPage(props: PageProps<"/broneeringud/uus">) {
  return (
    <Suspense fallback={<Card className="h-[600px] max-w-[860px] animate-pulse" />}>
      <NewBooking searchParams={props.searchParams as Promise<SP>} />
    </Suspense>
  );
}
