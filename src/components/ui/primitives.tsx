import Link from "next/link";
import { clsx } from "clsx";
import type { ComponentProps, ReactNode } from "react";

type BtnVariant = "primary" | "secondary" | "ghost";

const btnBase =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border px-3.5 text-sm font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime";
const btnVariants: Record<BtnVariant, string> = {
  primary: "border-lime bg-lime text-ink hover:bg-[#93d82a]",
  secondary: "border-line bg-white text-ink hover:bg-[#f9fafb]",
  ghost: "border-transparent bg-transparent text-ink hover:bg-line-soft",
};

export function Button({ variant = "secondary", className, size, ...props }: ComponentProps<"button"> & { variant?: BtnVariant; size?: "sm" }) {
  return <button type="button" className={clsx(btnBase, btnVariants[variant], size === "sm" && "h-[34px] px-2.5 text-[13px]", className)} {...props} />;
}

export function LinkButton({ variant = "secondary", className, size, ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: "sm" }) {
  return <Link className={clsx(btnBase, btnVariants[variant], size === "sm" && "h-[34px] px-2.5 text-[13px]", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-[14px] border border-line bg-white shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function CardHeader({ title, subtitle, action, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center justify-between gap-4 border-b border-line-soft px-5 py-4", className)}>
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export type Tone = "ok" | "warn" | "bad" | "neutral" | "info";

const toneClass: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: "bg-ok-bg", fg: "text-ok" },
  warn: { bg: "bg-warn-bg", fg: "text-warn" },
  bad: { bg: "bg-bad-bg", fg: "text-bad" },
  neutral: { bg: "bg-line-soft", fg: "text-muted" },
  info: { bg: "bg-[#eff8ff]", fg: "text-[#175cd3]" },
};

/** Staatusmärk täpiga (Figma "badge") */
export function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  const t = toneClass[tone];
  return (
    <span className={clsx("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap", t.bg, t.fg)}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Väike muutuse näit (+12%, −2) */
export function Delta({ value }: { value: string }) {
  const negative = value.startsWith("−") || value.startsWith("-");
  return (
    <span className={clsx("inline-flex h-[19px] items-center rounded-[10px] px-2 text-xs font-semibold", negative ? "bg-bad-bg text-bad" : "bg-ok-bg text-ok")}>
      {value}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[26px] font-bold tracking-[-0.4px] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}
