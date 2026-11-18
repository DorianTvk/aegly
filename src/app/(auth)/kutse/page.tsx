import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { findToken } from "@/server/auth-tokens";
import { InviteForm } from "../AuthForms";

export const metadata: Metadata = { title: "Kutse" };

async function Invite({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const row = await findToken(token, "INVITE");
  const inv = row?.data;
  const biz = inv ? await db.query.businesses.findFirst({ where: eq(s.businesses.id, inv.businessId), columns: { name: true } }) : null;
  if (!inv || !biz) {
    return (
      <>
        <h1 className="text-[26px] font-bold tracking-[-0.4px]">Kutse ei kehti</h1>
        <p className="mt-2 text-sm text-muted">Kutse on aegunud või juba kasutatud. Palu salongi omanikul saata uus kutse.</p>
        <Link href="/logi-sisse" className="mt-6 inline-block text-sm font-semibold underline-offset-4 hover:underline">
          Logi sisse
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-0.4px]">Liitu salongiga {biz.name}</h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        {inv.invitedBy} kutsus sind {inv.role === "ADMIN" ? "administraatoriks" : "töötajaks"}. Loo endale parool.
      </p>
      <InviteForm token={token} email={inv.email} name={inv.name} />
    </>
  );
}

export default function InvitePage(props: PageProps<"/kutse">) {
  return (
    <Suspense fallback={<div className="h-[360px]" />}>
      <Invite searchParams={props.searchParams as Promise<{ token?: string }>} />
    </Suspense>
  );
}
