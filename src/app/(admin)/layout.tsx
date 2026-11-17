import { Suspense } from "react";
import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";
import { getCurrentBusiness, getCurrentUser, ROLE_LABEL } from "@/lib/tenant";

async function SidebarWithData() {
  const business = await getCurrentBusiness();
  const user = await getCurrentUser();
  return <Sidebar businessName={business.name} userName={user.name} userRole={ROLE_LABEL[user.role]} />;
}

function SidebarSkeleton() {
  return <aside className="sticky top-0 h-screen w-[248px] shrink-0 border-r border-ink-2 bg-ink" />;
}

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarWithData />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-8 pt-7 pb-10">{children}</main>
      </div>
    </div>
  );
}
