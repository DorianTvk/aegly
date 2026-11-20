import type { Metadata } from "next";
import { Suspense } from "react";
import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireSession } from "@/lib/session";
import { Card } from "@/components/ui/primitives";
import { SettingsView } from "./SettingsView";
import { isSuperadmin, PLANS } from "@/lib/plans";
import { formatEuro } from "@/lib/time";
import { stripeConfigured, syncAccount } from "@/server/stripe";

export const metadata: Metadata = { title: "Seaded" };

async function Settings() {
  const { business: b, user } = await requireSession();
  // pärast Stripe'i vormi täitmist (või kuni konto pole aktiivne) värskenda staatus
  if (b.stripeAccountId && !b.stripeChargesEnabled && stripeConfigured()) {
    const acct = await syncAccount(b.stripeAccountId).catch(() => null);
    if (acct) {
      b.stripeChargesEnabled = !!acct.charges_enabled;
      b.stripeDetailsSubmitted = !!acct.details_submitted;
    }
  }
  const stripeStatus = !b.stripeAccountId ? "none" : b.stripeChargesEnabled ? "active" : b.stripeDetailsSubmitted ? "review" : "incomplete";
  const [users, staff, invites, sessionCount] = await Promise.all([
    db.query.users.findMany({ where: eq(s.users.businessId, b.id), orderBy: [asc(s.users.createdAt)] }),
    db.query.staffMembers.findMany({ where: and(eq(s.staffMembers.businessId, b.id), eq(s.staffMembers.active, true)), orderBy: [asc(s.staffMembers.sortOrder)] }),
    db.query.authTokens.findMany({ where: and(eq(s.authTokens.businessId, b.id), eq(s.authTokens.kind, "INVITE"), isNull(s.authTokens.usedAt), gt(s.authTokens.expiresAt, new Date())) }),
    db.$count(s.sessions, and(eq(s.sessions.userId, user.id), eq(s.sessions.mfaPending, false), gt(s.sessions.expiresAt, new Date()))),
  ]);
  return (
    <SettingsView
      me={{ name: user.name, email: user.email, role: user.role }}
      security={{ enabled: !!user.totpEnabledAt, recoveryLeft: user.recoveryCodes.length, required: isSuperadmin(user.email), otherSessions: Math.max(0, sessionCount - 1) }}
      users={users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, isMe: u.id === user.id, staffId: u.staffId }))}
      staff={staff.map((m) => ({ id: m.id, name: m.name }))}
      invites={invites.map((i) => ({ email: i.email, name: i.data?.name ?? i.email, role: i.data?.role ?? "STAFF", expires: i.expiresAt.toLocaleDateString("et-EE", { timeZone: b.timezone }) }))}
      business={{ planName: PLANS[b.plan].name, planPrice: b.billingPeriod === "YEAR" ? `${formatEuro(PLANS[b.plan].yearlyCents)} / aasta + km` : `${formatEuro(PLANS[b.plan].monthlyCents)} / kuu + km`, name: b.name, noShowProtection: b.noShowProtection, noShowThreshold: b.noShowThreshold, stripeStatus, stripeAvailable: stripeConfigured(), locale: b.locale, currency: b.currency, timezone: b.timezone }}
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
