import { Suspense } from "react";
import { cookies } from "next/headers";
import { Sidebar } from "@/components/admin/Sidebar";
import { SIDEBAR_COOKIE } from "@/components/admin/sidebar-cookie";
import { Topbar } from "@/components/admin/Topbar";
import { getCurrentBusiness, getCurrentUser, ROLE_LABEL } from "@/lib/tenant";
import { isSuperadmin } from "@/lib/plans";
import { ImpersonationBanner } from "./platvorm/ImpersonationBanner";
import { VerifyEmailBanner } from "@/components/admin/VerifyEmailBanner";
import { PlanBanner } from "@/components/admin/PlanBanner";

async function SidebarWithData() {
  const business = await getCurrentBusiness();
  const user = await getCurrentUser();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  return <Sidebar initialCollapsed={collapsed} businessName={business.name} userName={user.name} userRole={ROLE_LABEL[user.role]} role={user.role} superadmin={isSuperadmin(user.email)} />;
}

function SidebarSkeleton() {
  return <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-ink-2 bg-ink lg:block" />;
}

export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarWithData />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <ImpersonationBanner />
        </Suspense>
        <Suspense fallback={null}>
          <PlanBanner />
        </Suspense>
        <Suspense fallback={null}>
          <VerifyEmailBanner />
        </Suspense>
        <Topbar />
        <main className="flex-1 px-4 pt-5 pb-10 sm:px-6 lg:px-8 lg:pt-7">{children}</main>
      </div>
    </div>
  );
}
