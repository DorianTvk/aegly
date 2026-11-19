"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/** Halduspaneeli lehe viga: menüü jääb alles, viga teatatakse Sentryle */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <div className="mx-auto mt-10 max-w-[440px] rounded-[14px] border border-line bg-white p-6 text-center">
      <AlertTriangle size={28} className="mx-auto text-[#dc6803]" />
      <h1 className="mt-3 text-lg font-bold">Seda lehte ei õnnestunud avada</h1>
      <p className="mt-1 text-sm text-muted">Viga on meile automaatselt teada antud. Proovi uuesti või ava mõni teine leht.</p>
      {error.digest && <p className="mt-2 text-xs text-subtle">Vea kood: {error.digest}</p>}
      <button type="button" onClick={reset} className="mt-4 h-10 rounded-[10px] bg-lime px-4 text-sm font-semibold text-ink">
        Proovi uuesti
      </button>
    </div>
  );
}
