"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

/** Modaalaken (keskel) või paneel (paremal), natiivse <dialog> peal: fookus, Esc ja taust tulevad brauserilt. */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  variant = "modal",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "modal" | "drawer";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={clsx(
        "flex-col bg-white p-0 text-ink shadow-2xl backdrop:bg-[#0f172a]/40 open:flex",
        variant === "modal" ? "m-auto max-h-[90vh] w-[min(560px,calc(100vw-32px))] rounded-[16px]" : "mt-0 mr-0 mb-0 ml-auto h-screen max-h-screen w-[min(440px,100vw)]",
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
        <div>
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Sulge" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-line-soft hover:text-ink">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-4">{footer}</div>}
    </dialog>
  );
}
