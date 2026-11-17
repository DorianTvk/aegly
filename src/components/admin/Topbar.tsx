import { Suspense } from "react";
import { Bell, Plus, Search } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";
import { LinkButton } from "@/components/ui/primitives";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-white px-8">
      <div className="min-w-0 flex-1">
        <Suspense fallback={null}>
          <Breadcrumb />
        </Suspense>
      </div>

      <label className="relative hidden h-[38px] w-[320px] items-center rounded-[10px] border border-line bg-[#fcfcfd] md:flex">
        <Search size={16} className="absolute left-3 text-subtle" />
        <input
          type="search"
          placeholder="Otsi kliente, broneeringuid…"
          className="h-full w-full rounded-[10px] bg-transparent pr-14 pl-9 text-sm text-ink outline-none placeholder:text-subtle focus:ring-2 focus:ring-lime/60"
        />
        <kbd className="absolute right-3 rounded-[5px] border border-line px-1.5 text-[11px] text-muted">⌘K</kbd>
      </label>

      <button type="button" aria-label="Teavitused" className="relative grid size-[34px] place-items-center rounded-lg hover:bg-line-soft">
        <Bell size={18} className="text-ink" />
        <span className="absolute top-[7px] right-[8px] size-[7px] rounded-full border border-white bg-danger" />
      </button>

      <LinkButton href="/broneeringud/uus" variant="primary">
        <Plus size={16} strokeWidth={2.25} />
        Uus broneering
      </LinkButton>
    </header>
  );
}
