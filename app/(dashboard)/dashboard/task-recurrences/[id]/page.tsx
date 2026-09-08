import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskRecurrenceForm } from "@/components/forms/task-recurrence-forms";
import { branchScopeWhere, getCurrentBranchScope } from "@/lib/access/branch-access";
import { requireModuleAccess } from "@/lib/access/company-access";
import {
  deleteTaskRecurrence,
  runTaskRecurrenceNow,
  saveTaskRecurrence,
  toggleTaskRecurrenceActive,
} from "@/lib/actions/task-recurrences";
import { occurrenceIsoDate } from "@/lib/recurring-tasks/schedule";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { getTaskFormOptions } from "@/lib/tasks/page-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TaskRecurrenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("tasks:list");
  const companyId = user.companyId ?? "";
  await requireModuleAccess(companyId, "TASKS");
  const accessibleBranchIds = await getCurrentBranchScope(companyId);

  const recurrence = await prisma.taskrecurrence.findFirst({
    where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
  });
  if (!recurrence) notFound();

  const [options, generatedTasks] = await Promise.all([
    getTaskFormOptions(companyId),
    prisma.task.findMany({
      where: { recurrenceId: recurrence.id, deletedAt: null },
      orderBy: { occurrenceDate: "desc" },
      take: 20,
      select: { id: true, occurrenceDate: true, status: true, dueDate: true },
    }),
  ]);

  const canEdit = hasPermission(user, "tasks:edit");
  const canDelete = hasPermission(user, "tasks:delete");
  const formDefaults = {
    id: recurrence.id,
    title: recurrence.title,
    description: recurrence.description ?? "",
    priority: recurrence.priority,
    assignedUserId: recurrence.assignedUserId ?? "",
    customerId: recurrence.customerId ?? "",
    vendorId: recurrence.vendorId ?? "",
    shipmentJobId: recurrence.shipmentJobId ?? "",
    quotationId: recurrence.quotationId ?? "",
    invoiceId: recurrence.invoiceId ?? "",
    shipmentRequestId: recurrence.shipmentRequestId ?? "",
    frequency: recurrence.frequency,
    interval: String(recurrence.interval),
    timezone: recurrence.timezone,
    dueInDays: String(recurrence.dueInDays),
    startDate: occurrenceIsoDate(recurrence.startDate, recurrence.timezone),
    endDate: recurrence.endDate ? occurrenceIsoDate(recurrence.endDate, recurrence.timezone) : "",
  };

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="secondary">Phase 07</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">{recurrence.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            <Badge variant={recurrence.isActive ? "success" : "secondary"}>{recurrence.isActive ? "Active" : "Paused"}</Badge>
            {" "}Next run: {occurrenceIsoDate(recurrence.nextRunAt, recurrence.timezone)}
            {recurrence.lastRunAt ? ` · Last run: ${occurrenceIsoDate(recurrence.lastRunAt, recurrence.timezone)}` : ""}
          </p>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <form action={runTaskRecurrenceNow}>
              <input type="hidden" name="id" value={recurrence.id} />
              <Button type="submit" variant="outline" size="sm">Run now</Button>
            </form>
            <form action={toggleTaskRecurrenceActive}>
              <input type="hidden" name="id" value={recurrence.id} />
              <Button type="submit" variant="outline" size="sm">{recurrence.isActive ? "Pause" : "Resume"}</Button>
            </form>
            {canDelete ? (
              <form action={deleteTaskRecurrence}>
                <input type="hidden" name="id" value={recurrence.id} />
                <Button type="submit" variant="destructive" size="sm">Delete</Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit recurrence</CardTitle>
          <CardDescription>Editing template fields never disturbs the in-flight schedule (next/last run stay unchanged).</CardDescription>
        </CardHeader>
        <CardContent>
          <TaskRecurrenceForm action={saveTaskRecurrence} recurrence={formDefaults} canAssign={hasPermission(user, "tasks:assign")} {...options} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated tasks</CardTitle>
          <CardDescription>Most recent occurrences created by this recurrence.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Occurrence date</th>
                  <th className="px-4 py-3">Due date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {generatedTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-4 py-3">{task.occurrenceDate ? occurrenceIsoDate(task.occurrenceDate, recurrence.timezone) : "-"}</td>
                    <td className="px-4 py-3">{task.dueDate ? task.dueDate.toISOString().slice(0, 10) : "-"}</td>
                    <td className="px-4 py-3"><Badge variant="secondary">{task.status}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/tasks/${task.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!generatedTasks.length ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No occurrences generated yet.</td>
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
