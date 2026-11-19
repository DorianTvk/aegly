"use client";

import { Menu } from "lucide-react";

/** Mobiilis külgmenüü avamise nupp (Sidebar kuulab sündmust "aegly:menu") */
export function MenuButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("aegly:menu"))}
      aria-label="Ava menüü"
      className="grid size-9 shrink-0 place-items-center rounded-lg text-ink hover:bg-line-soft lg:hidden"
    >
      <Menu size={20} />
    </button>
  );
}
