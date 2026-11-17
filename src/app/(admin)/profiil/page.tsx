import type { Metadata } from "next";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isoWeekday, todayIso } from "@/lib/time";
import { Card } from "@/components/ui/primitives";
import { ProfileForm } from "./ProfileForm";

export const metadata: Metadata = { title: "Ettevõtte profiil" };

async function Profile() {
  const b = await getCurrentBusiness();
  const today = todayIso(b.timezone);
  const h = await db.query.openingHours.findFirst({ where: and(eq(s.openingHours.businessId, b.id), eq(s.openingHours.weekday, isoWeekday(today))) });
  const hh = (t: string | null) => (t ?? "").replace(/:00$/, "");
  const todayHours = !h || h.closed ? "Täna suletud" : `Avatud täna ${hh(h.startTime)}–${hh(h.endTime)}`;
  return <ProfileForm v={{ ...b, todayHours }} />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<Card className="h-[600px] animate-pulse" />}>
      <Profile />
    </Suspense>
  );
}
