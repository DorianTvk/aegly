import {
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  Code2,
  Gift,
  LayoutGrid,
  Layers,
  Megaphone,
  Package,
  SlidersHorizontal,
  Tag,
  Ticket,
  Users,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; section: string };

// Menüü Figma vaadete 14–19 järgi (uuem küljeriba)
export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Ülevaade",
    items: [
      { href: "/toolaud", label: "Töölaud", icon: LayoutGrid, section: "Ülevaade" },
      { href: "/kalender", label: "Kalender", icon: CalendarDays, section: "Ülevaade" },
      { href: "/kliendid", label: "Kliendid", icon: UserRound, section: "Ülevaade" },
      { href: "/aruanded", label: "Aruanded", icon: BarChart3, section: "Ülevaade" },
    ],
  },
  {
    section: "Teenused",
    items: [
      { href: "/teenused", label: "Teenused", icon: Layers, section: "Teenused" },
      { href: "/paketid", label: "Paketid", icon: Package, section: "Teenused" },
      { href: "/hinnakiri", label: "Hinnakiri", icon: Tag, section: "Teenused" },
    ],
  },
  {
    section: "Meeskond",
    items: [
      { href: "/tootajad", label: "Töötajad", icon: Users, section: "Meeskond" },
      { href: "/tooajad", label: "Tööajad ja vabad ajad", icon: Clock, section: "Meeskond" },
    ],
  },
  {
    section: "Müük",
    items: [
      { href: "/sooduskoodid", label: "Sooduskoodid", icon: Ticket, section: "Müük" },
      { href: "/kampaaniad", label: "Kampaaniad", icon: Megaphone, section: "Müük" },
      { href: "/kinkekaardid", label: "Kinkekaardid", icon: Gift, section: "Müük" },
    ],
  },
  {
    section: "Kanal",
    items: [
      { href: "/vidin", label: "Broneerimisvidin", icon: Code2, section: "Kanal" },
      { href: "/teavitused", label: "Teavitused", icon: Bell, section: "Kanal" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/seaded", label: "Seaded", icon: SlidersHorizontal, section: "Seaded" };

export function findNav(pathname: string): NavItem | undefined {
  const all = [...NAV.flatMap((g) => g.items), SETTINGS_ITEM];
  return all.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
}
