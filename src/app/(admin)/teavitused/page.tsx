import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { NOTIFICATIONS } from "@/lib/notifications";
import { appUrl } from "@/lib/app-url";
import { Card } from "@/components/ui/primitives";
import { NotificationsView } from "./NotificationsView";

export const metadata: Metadata = { title: "Teavitused" };

async function Notifications() {
  const b = await getCurrentBusiness();
  const [rows, url] = await Promise.all([db.query.notificationSettings.findMany({ where: eq(s.notificationSettings.businessId, b.id) }), appUrl()]);
  const byType = new Map(rows.map((r) => [r.type, r]));
  return (
    <NotificationsView
      sample={{
        "{eesnimi}": "Kertu",
        "{teenus}": "Klassikaline massaaž",
        "{kuupäev}": "T 3.11",
        "{kellaaeg}": "10:30",
        "{töötaja}": "Kadri Tamm",
        "{link}": `${url.replace(/^https?:\/\//, "")}/b/x7k2`,
        "{aadress}": b.address ?? "",
        "{salong}": b.name,
      }}
      initial={{
        emailSenderName: b.emailSenderName ?? b.name,
        smsSender: b.smsSender ?? b.name.normalize("NFD").replace(/[^A-Za-z0-9]/g, "").slice(0, 11),
        replyToEmail: b.replyToEmail ?? b.email ?? "",
        googleReviewUrl: b.googleReviewUrl ?? "",
        items: NOTIFICATIONS.map((n) => {
          const r = byType.get(n.type);
          return {
            type: n.type,
            emailEnabled: r?.emailEnabled ?? n.emailEnabled,
            smsEnabled: r?.smsEnabled ?? n.smsEnabled,
            offsetMinutes: r?.offsetMinutes ?? n.offsetMinutes,
            emailSubject: r?.emailSubject ?? n.emailSubject,
            emailBody: r?.emailBody ?? n.emailBody,
            smsBody: r?.smsBody ?? n.smsBody,
          };
        }),
      }}
    />
  );
}

export default function NotificationsPage() {
  return (
    <Suspense fallback={<Card className="h-[600px] animate-pulse" />}>
      <Notifications />
    </Suspense>
  );
}
