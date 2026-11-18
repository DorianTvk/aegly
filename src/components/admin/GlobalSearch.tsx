"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Search, User } from "lucide-react";
import { clsx } from "clsx";
import { searchAll, type SearchResult } from "./topbar-actions";

/** Ülariba otsing (⌘K / Ctrl+K): kliendid ja broneeringud */
export function GlobalSearch() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ q: string; items: SearchResult[] } | null>(null);
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(() => searchAll(term).then((items) => live && (setRes({ q: term, items }), setActive(0))), 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const term = q.trim();
  const items = res && res.q === term ? res.items : [];
  const show = focused && term.length >= 2;
  const go = (r: SearchResult) => {
    setFocused(false);
    setQ("");
    input.current?.blur();
    router.push(r.href);
  };

  return (
    <div className="relative hidden md:block">
      <label className="relative flex h-[38px] w-[320px] items-center rounded-[10px] border border-line bg-[#fcfcfd]">
        <Search size={16} className="absolute left-3 text-subtle" aria-hidden />
        <span className="sr-only">Otsi kliente ja broneeringuid</span>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded={show}
          aria-controls="global-search-results"
          aria-activedescendant={show && items[active] ? `gs-${items[active].id}` : undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (!show || !items.length) return;
            if (e.key === "ArrowDown") (e.preventDefault(), setActive((a) => (a + 1) % items.length));
            if (e.key === "ArrowUp") (e.preventDefault(), setActive((a) => (a - 1 + items.length) % items.length));
            if (e.key === "Enter") (e.preventDefault(), go(items[active]));
            if (e.key === "Escape") input.current?.blur();
          }}
          placeholder="Otsi kliente, broneeringuid…"
          className="h-full w-full rounded-[10px] bg-transparent pr-14 pl-9 text-sm text-ink outline-none placeholder:text-subtle focus:ring-2 focus:ring-lime/60"
        />
        <kbd className="absolute right-3 rounded-[5px] border border-line px-1.5 text-[11px] text-muted">⌘K</kbd>
      </label>
      {show && (
        <ul id="global-search-results" role="listbox" className="absolute top-11 left-0 z-30 max-h-[420px] w-[420px] overflow-y-auto rounded-[14px] border border-line bg-white py-1.5 shadow-[0_16px_40px_rgba(16,24,40,0.14)]">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted">{res?.q === term ? "Midagi ei leitud." : "Otsin…"}</li>
          ) : (
            items.map((r, i) => (
              <li
                key={r.type + r.id}
                id={`gs-${r.id}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r)}
                onMouseEnter={() => setActive(i)}
                className={clsx("flex cursor-pointer items-center gap-3 px-4 py-2.5", i === active && "bg-[#f9fafb]")}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-line-soft text-muted">
                  {r.type === "client" ? <User size={15} aria-hidden /> : <CalendarDays size={15} aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{r.title}</span>
                  <span className="block truncate text-xs text-muted">{r.subtitle}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
