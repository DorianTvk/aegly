"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Vidina viga – kolmes keeles, sest me ei tea, mis keeles klient oli */
export default function WidgetError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="grid min-h-dvh place-items-center bg-white p-6 text-center">
      <div className="max-w-[340px] space-y-2 text-[14px] text-[#475467]">
        <p className="text-[17px] font-semibold text-[#1f2937]">Midagi läks valesti</p>
        <p>Broneerimine ei õnnestunud. Proovi uuesti või võta salongiga otse ühendust.</p>
        <p className="text-[13px] opacity-70">Something went wrong. Please try again. · Что-то пошло не так. Попробуйте ещё раз.</p>
        <button type="button" onClick={reset} className="mt-3 h-11 rounded-full bg-[#1f2937] px-5 text-[14px] font-semibold text-white">
          Proovi uuesti · Try again
        </button>
      </div>
    </main>
  );
}
