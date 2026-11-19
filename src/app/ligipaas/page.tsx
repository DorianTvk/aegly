import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarCheck } from "lucide-react";
import { GateForm } from "./GateForm";

export const metadata: Metadata = { title: { absolute: "Aegly" }, robots: { index: false, follow: false } };

async function Form({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  return <GateForm next={next} />;
}

export default function GatePage(props: PageProps<"/ligipaas">) {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-[360px] space-y-6 rounded-[16px] border border-line bg-white p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2.5">
          <span className="grid size-[34px] place-items-center rounded-[9px] bg-lime">
            <CalendarCheck size={18} className="text-ink" />
          </span>
          <span className="text-[17px] font-bold">Aegly</span>
        </div>
        <div>
          <h1 className="text-lg font-bold">Leht on arenduses</h1>
          <p className="mt-1 text-sm text-muted">Sisenemiseks sisesta pääsuparool.</p>
        </div>
        <Suspense fallback={<div className="h-[140px]" />}>
          <Form searchParams={props.searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
