import { DashboardHeader } from "@/components/dashboard-header";
import { PlatformSidebar } from "@/components/platform-sidebar";
import { requireUserScope } from "@/lib/permissions/rbac";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserScope("PLATFORM");

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <PlatformSidebar user={user} />
      <div className="min-w-0 flex-1">
        <DashboardHeader
          user={user}
          panelLabel="Platform Panel"
          signOutCallbackUrl="/platform-login"
        />
        {children}
      </div>
    </div>
  );
}
