import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { branchScopeWhereNullable, getCurrentBranchScope } from "@/lib/access/branch-access";
import { getEnabledModules, requireActiveCompanyAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requireUserScope } from "@/lib/permissions/rbac";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserScope("COMPANY");
  await requireActiveCompanyAccess(user.companyId);
  const enabledModules = await getEnabledModules(user.companyId);
  const canViewNotifications = hasPermission(user, "notifications:view");
  const unreadNotificationCount = canViewNotifications
    ? await prisma.notification.count({
        where: {
          companyId: user.companyId ?? "",
          scope: "COMPANY",
          deletedAt: null,
          readAt: null,
          AND: [
            { OR: [{ userId: null }, { userId: user.id }] },
            branchScopeWhereNullable(await getCurrentBranchScope(user.companyId ?? "")),
          ],
        },
      })
    : 0;

  return (
    <div className="min-h-screen bg-background lg:flex">
      <AppSidebar user={user} enabledModules={enabledModules} />
      <div className="min-w-0 flex-1">
        <DashboardHeader
          user={user}
          notificationsHref={canViewNotifications ? "/dashboard/notifications" : undefined}
          unreadNotificationCount={unreadNotificationCount}
          showSearch
          canUseAiSearch={hasPermission(user, "ai:use")}
        />
        {children}
      </div>
    </div>
  );
}
