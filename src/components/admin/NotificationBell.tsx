"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CalendarCheck, CalendarClock, CalendarX, Code, Gift, ListPlus, Package } from "lucide-react";
import { clsx } from "clsx";
import { loadNotifications, markNotificationsSeen } from "./topbar-actions";

type Feed = Awaited<ReturnType<typeof loadNotifications>>;

const ICON = { BOOKING_NEW: CalendarCheck, BOOKING_CHANGED: CalendarClock, BOOKING_CANCELLED: CalendarX, WAITLIST: ListPlus, WIDGET_INSTALLED: Code, SHOP_GIFT: Gift, SHOP_PACKAGE: Package } as const;
const TONE: Record<string, string> = {
  BOOKING_NEW: "bg-ok-bg text-ok", BOOKING_CHANGED: "bg-[#eff8ff] text-[#175cd3]", BOOKING_CANCELLED: "bg-bad-bg text-bad",
  WAITLIST: "bg-warn-bg text-warn", WIDGET_INSTALLED: "bg-[#f7fee7] text-[#3f6212]",
  SHOP_GIFT: "bg-[#fdf2fa] text-[#c11574]", SHOP_PACKAGE: "bg-[#f4f3ff] text-[#5925dc]",
};

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "just nüüd";
  if (min < 60) return `${min} min tagasi`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h tagasi`;
  return new Date(iso).toLocaleDateString("et-EE", { day: "numeric", month: "numeric" });
}

/** Kelluke: veebist tulnud broneeringud, muudatused, tühistamised ja ootenimekiri. Kontrollib uusi iga minut. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [seenBefore, setSeenBefore] = useState<string | null>(null);
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    const load = () => loadNotifications().then((f) => live && setFeed(f)).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && feed && feed.unread > 0) {
      setSeenBefore(feed.seenAt);
      setFeed({ ...feed, unread: 0 });
      start(() => markNotificationsSeen());
    }
  };
  const unread = feed?.unread ?? 0;
  const isNew = (at: string) => !seenBefore || at > seenBefore;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Teavitused, ${unread} uut` : "Teavitused"}
        className="relative grid size-[34px] place-items-center rounded-lg hover:bg-line-soft"
      >
        <Bell size={18} className="text-ink" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[17px] min-w-[17px] place-items-center rounded-full border-2 border-white bg-danger px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Teavitused" className="absolute top-11 right-0 z-30 w-[380px] overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_16px_40px_rgba(16,24,40,0.14)]">
          <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <p className="text-sm font-semibold">Teavitused</p>
            <Link href="/teavitused/saadetud" onClick={() => setOpen(false)} className="text-xs font-semibold text-muted hover:text-ink">
              Saadetud kirjad
            </Link>
          </div>
          {!feed ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Laen…</p>
          ) : feed.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Teavitusi pole. Siia ilmuvad veebist tulnud broneeringud, muudatused ja tühistamised.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line-soft overflow-y-auto">
              {feed.items.map((i) => {
                const Icon = ICON[i.kind as keyof typeof ICON] ?? Bell;
                const inner = (
                  <>
                    <span className={clsx("grid size-8 shrink-0 place-items-center rounded-full", TONE[i.kind] ?? "bg-line-soft")}>
                      <Icon size={15} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[13px] font-semibold">
                        {i.title}
                        {isNew(i.at) && <span className="size-1.5 rounded-full bg-danger" aria-label="uus" />}
                      </span>
                      {i.body && <span className="mt-0.5 block text-[12px] text-muted">{i.body}</span>}
                      <span className="mt-0.5 block text-[11px] text-subtle">{ago(i.at)}</span>
                    </span>
                  </>
                );
                return (
                  <li key={i.id}>
                    {i.bookingId ? (
                      <Link href={`/broneeringud/${i.bookingId}`} onClick={() => setOpen(false)} className="flex gap-3 px-4 py-3 hover:bg-[#f9fafb]">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex gap-3 px-4 py-3">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
