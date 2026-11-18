import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Breadcrumb } from "./Breadcrumb";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { LinkButton } from "@/components/ui/primitives";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-white px-8">
      <div className="min-w-0 flex-1">
        <Suspense fallback={null}>
          <Breadcrumb />
        </Suspense>
      </div>
      <GlobalSearch />
      <NotificationBell />
      <LinkButton href="/broneeringud/uus" variant="primary">
        <Plus size={16} strokeWidth={2.25} />
        Uus broneering
      </LinkButton>
    </header>
  );
}
