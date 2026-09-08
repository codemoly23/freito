import Link from "next/link";
import { Bell, CheckCheck, ExternalLink, Trash2 } from "lucide-react";
import {
  deleteCompanyNotification,
  markAllCompanyNotificationsRead,
  markCompanyNotificationRead,
} from "@/lib/actions/notifications";
import { getCurrentBranchScope, branchScopeWhereNullable } from "@/lib/access/branch-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function CompanyNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requirePermission("notifications:view");
  const params = await searchParams;
  const filter = params.filter === "unread" ? "unread" : params.filter === "read" ? "read" : "all";
  const companyId = user.companyId ?? "";
  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  const notifications = await prisma.notification.findMany({
    where: {
      companyId,
      scope: "COMPANY",
      deletedAt: null,
      AND: [
        { OR: [{ userId: null }, { userId: user.id }] },
        branchScopeWhereNullable(accessibleBranchIds),
      ],
      ...(filter === "unread" ? { readAt: null } : filter === "read" ? { readAt: { not: null } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const canUpdate = hasPermission(user, "notifications:update");
  const canDelete = hasPermission(user, "notifications:delete");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge variant="secondary">Phase 8A</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Notifications</h1>
          <p className="mt-1 text-sm text-slate-600">Internal events for your company and assigned work.</p>
        </div>
        {canUpdate ? (
          <form action={markAllCompanyNotificationsRead}>
            <Button type="submit" variant="outline"><CheckCheck className="h-4 w-4" />Mark all as read</Button>
          </form>
        ) : null}
      </div>
      <div className="flex gap-2">
        {["all", "unread", "read"].map((value) => (
          <Button asChild key={value} size="sm" variant={filter === value ? "default" : "outline"}>
            <Link href={value === "all" ? "/dashboard/notifications" : `/dashboard/notifications?filter=${value}`}>{value[0].toUpperCase() + value.slice(1)}</Link>
          </Button>
        ))}
      </div>
      <section className="space-y-3">
        {notifications.map((notification) => (
          <Card className={notification.readAt ? "bg-white" : "border-cyan-200 bg-cyan-50/40"} key={notification.id}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"><Bell className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">{notification.title}</p>
                  {!notification.readAt ? <Badge variant="success">Unread</Badge> : <Badge variant="secondary">Read</Badge>}
                </div>
                <p className="mt-1 text-sm text-slate-600">{notification.message}</p>
                <p className="mt-2 text-xs text-slate-400">{notification.createdAt.toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {notification.linkUrl ? <Button asChild size="sm" variant="outline"><Link href={notification.linkUrl}><ExternalLink className="h-3.5 w-3.5" />Open</Link></Button> : null}
                {canUpdate && !notification.readAt ? <form action={markCompanyNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><Button size="sm" type="submit" variant="secondary">Mark read</Button></form> : null}
                {canDelete ? <form action={deleteCompanyNotification}><input type="hidden" name="notificationId" value={notification.id} /><Button aria-label={`Delete ${notification.title}`} size="sm" type="submit" variant="ghost"><Trash2 className="h-4 w-4" /></Button></form> : null}
              </div>
            </CardContent>
          </Card>
        ))}
        {!notifications.length ? <div className="rounded-md border border-dashed p-12 text-center text-sm text-slate-500">No notifications found.</div> : null}
      </section>
    </main>
  );
}
