"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheck,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { NAV, PLATFORM_ITEM, SETTINGS_ITEM, type NavItem } from "./nav";
import { canAccess, type Role } from "@/lib/permissions";
import { Avatar } from "@/components/ui/Avatar";
import { logout } from "@/app/(auth)/actions";

import { SIDEBAR_COOKIE } from "./sidebar-cookie";

function NavLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={clsx(
        "flex h-9 items-center gap-2.5 rounded-lg text-sm transition-colors",
        collapsed ? "justify-center px-0" : "px-2.5",
        active
          ? "bg-ink-2 font-semibold text-white"
          : "font-medium text-[#d1d5db] hover:bg-ink-2/60 hover:text-white",
      )}
    >
      <Icon
        size={18}
        strokeWidth={1.75}
        className={clsx("shrink-0", active ? "text-lime" : "text-[#9ca3af]")}
        aria-hidden
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

export function Sidebar({
  businessName,
  userName,
  userRole,
  role = "OWNER",
  superadmin = false,
  initialCollapsed = false,
}: {
  businessName: string;
  userName: string;
  userRole: string;
  role?: Role;
  superadmin?: boolean;
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [desktopCollapsed, setCollapsed] = useState(initialCollapsed);
  // mobiilis (< lg) on menüü sahtel, mille avab ülariba nupp
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  if (mobileOpen && openedAt !== pathname) setMobileOpen(false); // lehe vahetusel sulgub
  useEffect(() => {
    const open = () => {
      setOpenedAt(window.location.pathname);
      setMobileOpen(true);
    };
    const key = (e: KeyboardEvent) =>
      e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("aegly:menu", open);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("aegly:menu", open);
      window.removeEventListener("keydown", key);
    };
  }, []);
  const collapsed = desktopCollapsed && !mobileOpen;
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const toggle = () => {
    const next = !desktopCollapsed;
    setCollapsed(next);
    // küpsis, et server joonistaks järgmisel laadimisel kohe õige laiusega (ilma vilkumiseta)
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => canAccess(role, i.href)),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        aria-label="Külgmenüü"
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r border-ink-2 bg-ink transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
          collapsed ? "w-[72px]" : "w-[264px] lg:w-[248px]",
        )}
      >
        <div
          className={clsx(
            "flex items-center gap-2.5 pt-6 pb-4",
            collapsed ? "flex-col px-0" : "px-[22px]",
          )}
        >
          <div
            className="grid size-[34px] shrink-0 place-items-center rounded-[9px] bg-lime"
            title={collapsed ? `Aegly · ${businessName}` : undefined}
          >
            <CalendarCheck
              size={18}
              strokeWidth={2}
              className="text-ink"
              aria-hidden
            />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[15px] leading-tight font-bold text-white">
                Aegly
              </p>
              <p className="truncate text-xs text-subtle">{businessName}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Sulge menüü"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle hover:bg-ink-2 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Ava külgmenüü" : "Ahenda külgmenüü"}
            aria-expanded={!collapsed}
            title={collapsed ? "Ava menüü" : "Ahenda menüü"}
            className="hidden size-8 shrink-0 place-items-center rounded-lg text-subtle hover:bg-ink-2 hover:text-white lg:grid"
          >
            {collapsed ? (
              <ChevronsRight size={17} />
            ) : (
              <ChevronsLeft size={17} />
            )}
          </button>
        </div>

        <nav
          aria-label="Peamenüü"
          className={clsx(
            "flex-1 overflow-y-auto pb-4",
            collapsed ? "px-3" : "px-3.5",
          )}
        >
          {groups.map((group) => (
            <div key={group.section} className="mt-4 first:mt-2">
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-6 bg-ink-2" aria-hidden />
              ) : (
                <p className="mb-1.5 px-2.5 text-[11px] font-semibold tracking-[0.6px] text-muted uppercase">
                  {group.section}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isActive(item.href)}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className={clsx("pb-5", collapsed ? "px-3" : "px-3.5")}>
          {superadmin && (
            <NavLink
              item={PLATFORM_ITEM}
              active={isActive(PLATFORM_ITEM.href)}
              collapsed={collapsed}
            />
          )}
          <NavLink
            item={SETTINGS_ITEM}
            active={isActive(SETTINGS_ITEM.href)}
            collapsed={collapsed}
          />
          <div
            className={clsx(
              "mt-3 flex items-center gap-2.5 border-t border-ink-2 pt-3.5",
              collapsed ? "flex-col px-0" : "px-2",
            )}
          >
            <span title={collapsed ? `${userName} · ${userRole}` : undefined}>
              <Avatar name={userName} color="#7a5af8" size={34} dark />
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-white">
                  {userName}
                </p>
                <p className="text-xs text-subtle">{userRole}</p>
              </div>
            )}
            <form action={logout}>
              <button
                type="submit"
                aria-label="Logi välja"
                title="Logi välja"
                className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-ink-2 hover:text-white"
              >
                <LogOut size={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
