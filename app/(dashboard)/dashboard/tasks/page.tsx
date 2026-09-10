import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@/lib/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { getSavedViewsForPage, savedViewQueryString } from "@/lib/saved-views/queries";
import { SaveViewControl } from "@/components/saved-views/save-view-control";
import { updateTaskStatus } from "@/lib/actions/tasks";
import { AISuggestedTasksSection } from "@/components/tasks/ai-suggested-tasks-section";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { taskPriorities, taskStatuses } from "@/lib/validators/tasks";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; priority?: string; assignee?: string; due?: string }> }) {
  const user = await requirePermission("tasks:list");
  const companyId = user.companyId ?? "";
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  await requireModuleAccess(companyId, "TASKS");
  const params = await searchParams;
  const savedViews = await getSavedViewsForPage(user, "tasks");
  if (!Object.values(params).some(Boolean)) {
    const defaultView = savedViews.find((view) => view.isDefault);
    const query = defaultView ? savedViewQueryString(defaultView.filters) : "";
    if (query) redirect(`/dashboard/tasks?${query}`);
  }
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
  const dueDate: Prisma.DateTimeNullableFilter | undefined =
    params.due === "overdue" ? { lt: todayStart }
      : params.due === "today" ? { gte: todayStart, lte: todayEnd }
        : params.due === "upcoming" ? { gt: todayEnd }
          : undefined;
  const where: Prisma.taskWhereInput = {
    companyId,
    deletedAt: null,
    ...branchScopeWhere(accessibleBranchIds),
    ...(params.status && taskStatuses.includes(params.status as typeof taskStatuses[number]) ? { status: params.status as typeof taskStatuses[number] } : {}),
    ...(params.priority && taskPriorities.includes(params.priority as typeof taskPriorities[number]) ? { priority: params.priority as typeof taskPriorities[number] } : {}),
    ...(params.assignee === "unassigned" ? { assignedUserId: null } : params.assignee ? { assignedUserId: params.assignee } : {}),
    ...(dueDate ? { dueDate, status: { notIn: ["DONE", "CANCELLED"] } } : {}),
    ...(params.q ? { OR: [
      { title: { contains: params.q } }, { description: { contains: params.q } },
      { shipmentjob: { jobNo: { contains: params.q } } }, { quotation: { quoteNo: { contains: params.q } } },
      { invoice: { invoiceNo: { contains: params.q } } }, { shipmentrequest: { requestNo: { contains: params.q } } },
      { customer: { name: { contains: params.q } } },
    ] } : {}),
  };
  const [tasks, users, myOpen, overdue, dueToday, unassigned] = await Promise.all([
    prisma.task.findMany({ where, include: { user_task_assignedUserIdTouser: { select: { name: true } }, user_task_createdByIdTouser: { select: { name: true } }, customer: { select: { name: true } }, shipmentjob: { select: { jobNo: true } }, quotation: { select: { quoteNo: true } }, invoice: { select: { invoiceNo: true } }, shipmentrequest: { select: { requestNo: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], take: 100 }),
    prisma.user.findMany({ where: { companyId, scope: "COMPANY", status: "ACTIVE", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.task.count({ where: { companyId, assignedUserId: user.id, deletedAt: null, status: { notIn: ["DONE", "CANCELLED"] }, ...branchScopeWhere(accessibleBranchIds) } }),
    prisma.task.count({ where: { companyId, deletedAt: null, dueDate: { lt: todayStart }, status: { notIn: ["DONE", "CANCELLED"] }, ...branchScopeWhere(accessibleBranchIds) } }),
    prisma.task.count({ where: { companyId, deletedAt: null, dueDate: { gte: todayStart, lte: todayEnd }, status: { notIn: ["DONE", "CANCELLED"] }, ...branchScopeWhere(accessibleBranchIds) } }),
    prisma.task.count({ where: { companyId, deletedAt: null, assignedUserId: null, status: { notIn: ["DONE", "CANCELLED"] }, ...branchScopeWhere(accessibleBranchIds) } }),
  ]);
  const canEdit = hasPermission(user, "tasks:edit");
  return <main className="space-y-6 p-4 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="mt-3 text-2xl font-semibold">Tasks</h1><p className="text-sm text-slate-600">Internal freight operations and team collaboration.</p></div><div className="flex gap-2">{hasPermission(user, "exports:csv") ? <Button asChild size="sm" variant="outline"><a download href="/api/exports/tasks">Download CSV</a></Button> : null}{hasPermission(user, "tasks:create") ? <Button asChild><Link href="/dashboard/tasks/new">Create Task</Link></Button> : null}</div></div>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Kpi label="My open tasks" value={myOpen} /><Kpi label="Overdue tasks" value={overdue} /><Kpi label="Due today" value={dueToday} /><Kpi label="Unassigned tasks" value={unassigned} /></section>
    <AISuggestedTasksSection />
    <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-6">
      <Input className="md:col-span-2" defaultValue={params.q ?? ""} name="q" placeholder="Search task or linked reference" />
      <select className="h-10 rounded-md border px-3 text-sm" defaultValue={params.status ?? ""} name="status"><option value="">All statuses</option>{taskStatuses.map((value) => <option key={value}>{value}</option>)}</select>
      <select className="h-10 rounded-md border px-3 text-sm" defaultValue={params.priority ?? ""} name="priority"><option value="">All priorities</option>{taskPriorities.map((value) => <option key={value}>{value}</option>)}</select>
      <select className="h-10 rounded-md border px-3 text-sm" defaultValue={params.assignee ?? ""} name="assignee"><option value="">All assignees</option><option value="unassigned">Unassigned</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name ?? item.email}</option>)}</select>
      <div className="flex gap-2"><select className="h-10 min-w-0 flex-1 rounded-md border px-2 text-sm" defaultValue={params.due ?? ""} name="due"><option value="">Any due date</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="upcoming">Upcoming</option></select><Button type="submit">Filter</Button></div>
    </form>
    <SaveViewControl pageKey="tasks" views={savedViews} />
    <section className="space-y-3">{tasks.map((task) => {
      const overdueTask = task.dueDate && task.dueDate < todayStart && !["DONE", "CANCELLED"].includes(task.status);
      const reference = task.shipmentjob?.jobNo ?? task.quotation?.quoteNo ?? task.invoice?.invoiceNo ?? task.shipmentrequest?.requestNo ?? task.customer?.name;
      return <Card key={task.id}><CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_200px_180px]"><div><div className="flex flex-wrap gap-2"><Badge variant={task.priority === "URGENT" ? "danger" : task.priority === "HIGH" ? "warning" : "secondary"}>{task.priority}</Badge><Badge variant={task.status === "DONE" ? "success" : task.status === "CANCELLED" ? "danger" : "secondary"}>{task.status}</Badge>{overdueTask ? <Badge variant="danger">OVERDUE</Badge> : null}</div><Link className="mt-3 block text-lg font-semibold hover:underline" href={`/dashboard/tasks/${task.id}`}>{task.title}</Link><p className="mt-1 text-sm text-slate-500">{reference ?? "No linked record"}</p></div><div className="text-sm"><p>Assignee: {task.user_task_assignedUserIdTouser?.name ?? "Unassigned"}</p><p className="text-slate-500">Due: {task.dueDate?.toLocaleDateString() ?? "-"}</p></div>{canEdit ? <form action={updateTaskStatus}><input name="id" type="hidden" value={task.id} /><select aria-label={`Status for ${task.title}`} className="h-10 w-full rounded-md border px-3 text-sm" defaultValue={task.status} name="status">{taskStatuses.map((value) => <option key={value}>{value}</option>)}</select><Button className="mt-2 w-full" size="sm" type="submit" variant="outline">Update status</Button></form> : null}</CardContent></Card>;
    })}{!tasks.length ? <p className="rounded-md border border-dashed bg-white p-12 text-center text-sm text-slate-500">No tasks found.</p> : null}</section>
  </main>;
}

function Kpi({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-5"><p className="text-xs uppercase text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>; }
