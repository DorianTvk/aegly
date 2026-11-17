"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { findNav } from "./nav";

export function Breadcrumb() {
  const item = findNav(usePathname());
  return (
    <nav aria-label="Asukoht" className="flex min-w-0 items-center gap-2 text-sm">
      <span className="text-muted">{item?.section ?? "Aegly"}</span>
      <ChevronRight size={14} className="text-subtle" />
      <span className="truncate font-semibold text-ink">{item?.label ?? ""}</span>
    </nav>
  );
}
