import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { LEGAL } from "./legal";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const approved = process.env.LEGAL_APPROVED === "true";
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[820px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-[30px] place-items-center rounded-[8px] bg-lime">
              <CalendarCheck size={16} className="text-ink" aria-hidden />
            </span>
            <span className="text-[16px] font-bold">Aegly</span>
          </Link>
          <nav aria-label="Dokumendid" className="flex gap-4 text-sm text-muted">
            <Link href="/tingimused" className="hover:text-ink">Tingimused</Link>
            <Link href="/privaatsus" className="hover:text-ink">Privaatsus</Link>
            <Link href="/andmetootlus" className="hover:text-ink">Andmetöötlus</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[820px] px-6 py-10">
        {!approved && (
          <p role="note" className="mb-8 rounded-[10px] border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-sm text-[#93370d]">
            Dokumendi mustand. Lõplik tekst avaldatakse pärast juriidilist ülevaatust.
          </p>
        )}
        <article className="legal space-y-4 text-[15px] leading-relaxed text-[#344054]">{children}</article>
        <p className="mt-12 border-t border-line pt-6 text-sm text-muted">
          {LEGAL.company}, registrikood {LEGAL.regCode}, {LEGAL.address}. Kontakt: {LEGAL.email}
        </p>
      </main>
    </div>
  );
}
