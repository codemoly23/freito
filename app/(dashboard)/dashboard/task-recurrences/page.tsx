import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getCurrentBranchScope } from "@/lib/access/branch-access";
import { requireModuleAccess } from "@/lib/access/company-access";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TaskRecurrencesPage() {
  const user = await requirePermission("tasks:list");
  const companyId = user.companyId ?? "";
  await requireModuleAccess(companyId, "TASKS");
  const accessibleBranchIds = await getCurrentBranchScope(companyId);

  const recurrences = await prisma.taskrecurrence.findMany({
    where: { companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: { user_taskrecurrence_assignedUserIdTouser: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="secondary">Phase 07</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Recurring Tasks</h1>
          <p className="mt-1 text-sm text-slate-600">Template tasks that automatically regenerate on a schedule.</p>
        </div>
        {hasPermission(user, "tasks:create") ? (
          <Button asChild>
            <Link href="/dashboard/task-recurrences/new">New recurrence</Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recurrence rules</CardTitle>
          <CardDescription>Each generates one task per due occurrence via the protected scheduled runner.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Repeats</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Next run</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {recurrences.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{r.title}</td>
                    <td className="px-4 py-3">Every {r.interval} {r.frequency.toLowerCase()}{r.interval > 1 ? "s" : ""}</td>
                    <td className="px-4 py-3 text-slate-600">{r.user_taskrecurrence_assignedUserIdTouser?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{r.nextRunAt.toISOString().slice(0, 10)}</td>
                    <td className="px-4 py-3"><Badge variant={r.isActive ? "success" : "secondary"}>{r.isActive ? "Active" : "Paused"}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/task-recurrences/${r.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!recurrences.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No recurring tasks yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
