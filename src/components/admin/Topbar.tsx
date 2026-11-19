import { Suspense } from "react";
import { Plus } from "lucide-react";
import { MenuButton } from "./MenuButton";
import { Breadcrumb } from "./Breadcrumb";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { LinkButton } from "@/components/ui/primitives";

export function Topbar({ platform }: { platform: boolean }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-white px-3 sm:gap-4 sm:px-6 lg:h-16 lg:px-8">
      <MenuButton />
      <div className="min-w-0 flex-1">
        <Suspense fallback={null}>
          <Breadcrumb />
        </Suspense>
      </div>
      {!platform && (
        <>
          <GlobalSearch />
          <NotificationBell />
          <LinkButton href="/broneeringud/uus" variant="primary" aria-label="Uus broneering" className="px-2.5 sm:px-4">
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">Uus broneering</span>
          </LinkButton>
        </>
      )}
    </header>
  );
}
