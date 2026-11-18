"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

/**
 * Teade, mis kaob õnnestumise korral ise (vaikimisi 5 s). Veateated jäävad nähtavale, kuni kasutaja need sulgeb.
 * `token` – iga uus väärtus (nt uus vastuse objekt) näitab teate uuesti.
 */
export function Flash({ ok, token, children, duration = 5000, className }: { ok: boolean; token: unknown; children: ReactNode; duration?: number; className?: string }) {
  const [hidden, setHidden] = useState<unknown>(null);
  const [leaving, setLeaving] = useState<unknown>(null);

  useEffect(() => {
    if (!ok) return;
    const fade = setTimeout(() => setLeaving(token), duration - 300);
    const hide = setTimeout(() => setHidden(token), duration);
    return () => {
      clearTimeout(fade);
      clearTimeout(hide);
    };
  }, [ok, token, duration]);

  if (hidden === token) return null;
  return (
    <div
      role={ok ? "status" : "alert"}
      className={clsx(
        "flex items-start gap-2 rounded-[10px] px-3 py-2 text-sm transition-opacity duration-300",
        ok ? "bg-ok-bg text-ok" : "bg-bad-bg text-bad",
        leaving === token && "opacity-0",
        className,
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <button type="button" onClick={() => setHidden(token)} aria-label="Sulge teade" className="-mr-1 grid size-5 shrink-0 place-items-center rounded opacity-60 hover:opacity-100">
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
