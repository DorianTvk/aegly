import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { readPendingMfa } from "@/lib/session";
import { MfaForm } from "./MfaForm";

export const metadata: Metadata = { title: "Kinnituskood" };

async function Form({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const pending = await readPendingMfa();
  if (!pending) redirect("/logi-sisse");
  const { next } = await searchParams;
  return <MfaForm next={next} email={pending.user.email} />;
}

export default function MfaPage(props: PageProps<"/logi-sisse/kood">) {
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-[-0.4px]">Kinnituskood</h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        Ava oma autentimisrakendus (nt Google Authenticator) ja sisesta Aegly 6-kohaline kood.
      </p>
      <Suspense fallback={null}>
        <Form searchParams={props.searchParams as Promise<{ next?: string }>} />
      </Suspense>
    </>
  );
}
