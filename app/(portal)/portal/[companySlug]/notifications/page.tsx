import Link from "next/link";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { markAllPortalNotificationsRead, markPortalNotificationRead } from "@/lib/actions/notifications";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function PortalNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ companySlug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { companySlug } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const query = await searchParams;
  const filter = query.filter === "unread" ? "unread" : query.filter === "read" ? "read" : "all";
  const notifications = await prisma.notification.findMany({
    where: {
      companyId: account.companyId,
      clientPortalAccountId: account.id,
      scope: "CLIENT_PORTAL",
      deletedAt: null,
      ...(filter === "unread" ? { readAt: null } : filter === "read" ? { readAt: { not: null } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const markRead = markPortalNotificationRead.bind(null, companySlug);
  const markAll = markAllPortalNotificationsRead.bind(null, companySlug);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div><p className="text-sm text-cyan-300">Client Portal</p><h1 className="mt-1 text-2xl font-semibold">Notifications</h1><p className="mt-1 text-sm text-slate-300">{account.customer.name}</p></div>
          <Button asChild variant="outline"><Link href={`/portal/${companySlug}`}>Portal home</Link></Button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {["all", "unread", "read"].map((value) => <Button asChild key={value} size="sm" variant={filter === value ? "default" : "outline"}><Link href={value === "all" ? `/portal/${companySlug}/notifications` : `/portal/${companySlug}/notifications?filter=${value}`}>{value[0].toUpperCase() + value.slice(1)}</Link></Button>)}
          </div>
          <form action={markAll}><Button type="submit" variant="outline"><CheckCheck className="h-4 w-4" />Mark all as read</Button></form>
        </div>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card className={notification.readAt ? "bg-white" : "border-cyan-200 bg-cyan-50/40"} key={notification.id}>
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-cyan-700"><Bell className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{notification.title}</p>{notification.readAt ? <Badge variant="secondary">Read</Badge> : <Badge variant="success">Unread</Badge>}</div><p className="mt-1 text-sm text-slate-600">{notification.message}</p><p className="mt-2 text-xs text-slate-400">{notification.createdAt.toLocaleString()}</p></div>
                <div className="flex flex-wrap gap-2">
                  {notification.linkUrl ? <Button asChild size="sm" variant="outline"><Link href={notification.linkUrl}><ExternalLink className="h-3.5 w-3.5" />Open</Link></Button> : null}
                  {!notification.readAt ? <form action={markRead}><input type="hidden" name="notificationId" value={notification.id} /><Button size="sm" type="submit" variant="secondary">Mark read</Button></form> : null}
                </div>
              </CardContent>
            </Card>
          ))}
          {!notifications.length ? <div className="rounded-md border border-dashed bg-white p-12 text-center text-sm text-slate-500">No notifications found.</div> : null}
        </div>
      </section>
    </main>
  );
}
