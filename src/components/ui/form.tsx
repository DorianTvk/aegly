import { clsx } from "clsx";
import { Flash } from "./Flash";
import type { ComponentProps, ReactNode } from "react";

const inputBase =
  "h-10 rounded-[10px] border border-line bg-white px-3 text-sm text-ink outline-none transition-shadow placeholder:text-subtle focus:border-lime focus:ring-3 focus:ring-lime/30 disabled:bg-line-soft aria-invalid:border-danger";
export const inputClass = `${inputBase} w-full`;

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | string[];
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={clsx("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {msg ? <p className="text-xs text-bad">{msg}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx(inputClass, "h-auto min-h-[88px] py-2.5", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx(inputClass, "pr-9", className)} {...props} />;
}

/** Sisend ühikuga paremal (min, €, %) */
export function UnitInput({ unit, className, ...props }: ComponentProps<"input"> & { unit: string }) {
  // className määrab välise laiuse (nt w-[110px])
  return (
    <div className={clsx("relative", className)}>
      <input className={clsx(inputClass, "pr-12")} {...props} />
      <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">{unit}</span>
    </div>
  );
}

/** Lüliti; töötab tavalise vormina (checkbox) */
export function Toggle({ label, description, className, ...props }: ComponentProps<"input"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={clsx("flex cursor-pointer items-start justify-between gap-4", className)}>
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" {...props} />
        <span className="h-6 w-11 rounded-full bg-[#d0d5dd] transition-colors peer-checked:bg-lime peer-focus-visible:ring-3 peer-focus-visible:ring-lime/40" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Vormi tulemuse teade: õnnestumine kaob 5 s pärast, viga jääb (vt Flash) */
export function FormMessage({ state }: { state?: { ok?: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return (
    <Flash ok={!!state.ok} token={state}>
      {state.message}
    </Flash>
  );
}

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string[] | undefined> } | null;

/** Kellaaja valik 24 h formaadis (natiivne time-väli sõltub brauseri lokaadist ja võib näidata AM/PM) */
export function TimeSelect({ value, onChange, step = 15, className, ...props }: Omit<ComponentProps<"select">, "onChange" | "value"> & { value: string; onChange: (v: string) => void; step?: number }) {
  const options: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) options.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  if (!options.includes(value)) options.push(value);
  options.sort();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={clsx(inputBase, "w-[96px] tabular-nums", className)} {...props}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Vormi jaoks (kontrollimata) 24 h kellaaja valik */
export function TimeField({ defaultValue = "09:00", step = 15, className, ...props }: Omit<ComponentProps<"select">, "defaultValue"> & { defaultValue?: string; step?: number }) {
  const options: string[] = [];
  for (let m = 0; m < 24 * 60; m += step) options.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return (
    <select defaultValue={defaultValue} className={clsx(inputClass, "tabular-nums", className)} {...props}>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
