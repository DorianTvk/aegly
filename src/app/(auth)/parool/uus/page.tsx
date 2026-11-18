import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { findToken } from "@/server/auth-tokens";
import { ResetForm } from "../../AuthForms";

export const metadata: Metadata = { title: "Uus parool" };

async function Form({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await findToken(token, "RESET");
  if (!valid) {
    return (
      <div className="space-y-4">
        <p className="rounded-[10px] border border-bad/30 bg-bad-bg px-4 py-3 text-sm text-bad">Link on aegunud või juba kasutatud.</p>
        <Link href="/parool/unustasin" className="block text-center text-sm font-semibold underline-offset-4 hover:underline">
          Küsi uus link
        </Link>
      </div>
    );
  }
  return <ResetForm token={token} />;
}

export default function NewPasswordPage(props: PageProps<"/parool/uus">) {
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-0.4px]">Määra uus parool</h1>
      <p className="mt-1 mb-8 text-sm text-muted">Pärast salvestamist logitakse sind sisse ja kõik teised seadmed logitakse välja.</p>
      <Suspense fallback={<div className="h-[220px]" />}>
        <Form searchParams={props.searchParams as Promise<{ token?: string }>} />
      </Suspense>
    </>
  );
}
