import { prisma } from "@/lib/db/prisma";
import { requirePlatformPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PlatformAuditPage() {
  await requirePlatformPermission("platform:audit:view");
  const auditLogs = await prisma.auditlog.findMany({
    where: {
      OR: [
        { action: { startsWith: "PLATFORM_" } },
        { action: "auth.login", user: { scope: "PLATFORM" } },
      ],
    },
    include: {
      user: { select: { name: true, email: true } },
      company: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Platform Audit</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Platform audit</h1>
        <p className="mt-1 text-sm text-slate-600">
          Latest platform-level tenant and access events.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Audit activity</CardTitle>
          <CardDescription>Newest entries first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded-md border border-slate-200 bg-white p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium text-slate-950">{log.action}</span>
                <span className="text-slate-500">{log.createdAt.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Actor: {log.user?.name ?? log.user?.email ?? "-"} | Company: {log.company?.name ?? "-"}
              </p>
            </div>
          ))}
          {!auditLogs.length ? (
            <p className="rounded-md border border-slate-200 p-6 text-center text-sm text-slate-500">
              No platform audit entries yet.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
