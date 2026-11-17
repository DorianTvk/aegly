import type { Metadata } from "next";
import { Suspense } from "react";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { Card } from "@/components/ui/primitives";
import { SettingsView } from "./SettingsView";

export const metadata: Metadata = { title: "Seaded" };

async function Settings() {
  const { business: b, user } = await requireSession();
  const users = await db.query.users.findMany({ where: eq(s.users.businessId, b.id), orderBy: [asc(s.users.createdAt)] });
  return (
    <SettingsView
      me={{ name: user.name, email: user.email, role: user.role }}
      users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isMe: u.id === user.id }))}
      business={{ name: b.name, noShowProtection: b.noShowProtection, noShowThreshold: b.noShowThreshold, stripeAccountId: b.stripeAccountId, locale: b.locale, currency: b.currency, timezone: b.timezone }}
    />
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<Card className="h-[600px] max-w-[920px] animate-pulse" />}>
      <Settings />
    </Suspense>
  );
}
