"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ChevronDown, LogOut } from "lucide-react";
import { clsx } from "clsx";
import { NAV, SETTINGS_ITEM, type NavItem } from "./nav";
import { Avatar } from "@/components/ui/Avatar";
import { logout } from "@/app/(auth)/actions";

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
        active ? "bg-ink-2 font-semibold text-white" : "font-medium text-[#d1d5db] hover:bg-ink-2/60 hover:text-white",
      )}
    >
      <Icon size={18} strokeWidth={1.75} className={active ? "text-lime" : "text-[#9ca3af]"} />
      {item.label}
    </Link>
  );
}

export function Sidebar({ businessName, userName, userRole }: { businessName: string; userName: string; userRole: string }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col border-r border-ink-2 bg-ink">
      <div className="flex items-center gap-2.5 px-[22px] pt-6 pb-4">
        <div className="grid size-[34px] place-items-center rounded-[9px] bg-lime">
          <CalendarCheck size={18} strokeWidth={2} className="text-ink" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold leading-tight text-white">Aegly</p>
          <p className="truncate text-xs text-subtle">{businessName}</p>
        </div>
        <ChevronDown size={16} className="text-subtle" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3.5 pb-4">
        {NAV.map((group) => (
          <div key={group.section} className="mt-4 first:mt-2">
            <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.6px] text-muted">{group.section}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3.5 pb-5">
        <NavLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.href)} />
        <div className="mt-3 flex items-center gap-2.5 border-t border-ink-2 px-2 pt-3.5">
          <Avatar name={userName} color="#7a5af8" size={34} dark />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{userName}</p>
            <p className="text-xs text-subtle">{userRole}</p>
          </div>
          <form action={logout}>
            <button type="submit" aria-label="Logi välja" title="Logi välja" className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-ink-2 hover:text-white">
              <LogOut size={16} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
