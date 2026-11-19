"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/** Viimane kaitseliin: kogu rakendus kukkus. Teatab Sentryle ja näitab lihtsat lehte. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="et">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#f3f4f6", color: "#1f2937" }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Midagi läks valesti</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Viga on meile teada antud. Proovi uuesti – kui probleem kordub, võta ühendust.</p>
          {error.digest && <p style={{ color: "#9ca3af", fontSize: 12 }}>Vea kood: {error.digest}</p>}
          <button type="button" onClick={reset} style={{ marginTop: 12, height: 40, padding: "0 16px", borderRadius: 10, border: 0, background: "#a3e635", fontWeight: 600, cursor: "pointer" }}>
            Proovi uuesti
          </button>
        </div>
      </body>
    </html>
  );
}
