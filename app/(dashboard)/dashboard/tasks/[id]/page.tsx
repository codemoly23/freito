import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskCommentForm } from "@/components/forms/task-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireModuleAccess } from "@/lib/access/company-access";
import { addTaskComment, deleteTask, updateTaskStatus } from "@/lib/actions/tasks";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { taskStatuses } from "@/lib/validators/tasks";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("tasks:view");
  const companyId = user.companyId ?? "";
  await requireModuleAccess(companyId, "TASKS");
  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      user_task_assignedUserIdTouser: { select: { name: true, email: true } },
      user_task_createdByIdTouser: { select: { name: true, email: true } },
      customer: { select: { id: true, name: true } },
      vendor: { select: { id: true, name: true } },
      shipmentjob: { select: { id: true, jobNo: true } },
      quotation: { select: { id: true, quoteNo: true } },
      invoice: { select: { id: true, invoiceNo: true } },
      shipmentrequest: { select: { id: true, requestNo: true } },
      taskcomment: { where: { deletedAt: null }, include: { user: { select: { name: true, email: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) notFound();
  const auditLogs = await prisma.auditlog.findMany({
    where: { companyId, entityType: "Task", entityId: task.id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const overdue = task.dueDate && task.dueDate < new Date() && !["DONE", "CANCELLED"].includes(task.status);
  return <main className="space-y-6 p-4 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex gap-2"><Badge variant={task.priority === "URGENT" ? "danger" : task.priority === "HIGH" ? "warning" : "secondary"}>{task.priority}</Badge><Badge variant={task.status === "DONE" ? "success" : task.status === "CANCELLED" ? "danger" : "secondary"}>{task.status}</Badge>{overdue ? <Badge variant="danger">OVERDUE</Badge> : null}</div><h1 className="mt-3 text-2xl font-semibold">{task.title}</h1></div><div className="flex gap-2">{hasPermission(user, "tasks:edit") ? <Button asChild variant="outline"><Link href={`/dashboard/tasks/${task.id}/edit`}>Edit</Link></Button> : null}{hasPermission(user, "tasks:delete") ? <form action={deleteTask}><input name="id" type="hidden" value={task.id} /><Button type="submit" variant="destructive">Delete</Button></form> : null}</div></div>
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
      <Card><CardHeader><CardTitle>Task information</CardTitle></CardHeader><CardContent className="space-y-5"><p className="whitespace-pre-wrap text-sm text-slate-700">{task.description ?? "No description."}</p><div className="grid gap-4 text-sm sm:grid-cols-2"><Item label="Assignee" value={task.user_task_assignedUserIdTouser?.name ?? "Unassigned"} /><Item label="Created by" value={task.user_task_createdByIdTouser.name ?? task.user_task_createdByIdTouser.email} /><Item label="Due date" value={task.dueDate?.toLocaleDateString() ?? "-"} /><Item label="Completed" value={task.completedAt?.toLocaleString() ?? "-"} /></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Linked records</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        {task.shipmentjob ? <LinkRow href={`/dashboard/shipments/${task.shipmentjob.id}`} label="Shipment" value={task.shipmentjob.jobNo} /> : null}
        {task.shipmentrequest ? <LinkRow href={`/dashboard/shipment-requests/${task.shipmentrequest.id}`} label="Request" value={task.shipmentrequest.requestNo} /> : null}
        {task.quotation ? <LinkRow href={`/dashboard/quotations/${task.quotation.id}`} label="Quotation" value={task.quotation.quoteNo} /> : null}
        {task.invoice ? <LinkRow href={`/dashboard/invoices/${task.invoice.id}`} label="Invoice" value={task.invoice.invoiceNo} /> : null}
        {task.customer ? <Item label="Customer" value={task.customer.name} /> : null}
        {task.vendor ? <Item label="Vendor" value={task.vendor.name} /> : null}
        {!task.shipmentjob && !task.shipmentrequest && !task.quotation && !task.invoice && !task.customer && !task.vendor ? <p className="text-slate-500">No linked records.</p> : null}
      </CardContent></Card>
    </div>
    {hasPermission(user, "tasks:edit") ? <Card><CardHeader><CardTitle>Update status</CardTitle></CardHeader><CardContent><form action={updateTaskStatus} className="flex max-w-md gap-2"><input name="id" type="hidden" value={task.id} /><select className="h-10 flex-1 rounded-md border px-3 text-sm" defaultValue={task.status} name="status">{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select><Button type="submit">Save status</Button></form></CardContent></Card> : null}
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Comments</CardTitle></CardHeader><CardContent className="space-y-4">{hasPermission(user, "tasks:comment") ? <TaskCommentForm action={addTaskComment} taskId={task.id} /> : null}<div className="space-y-3">{task.taskcomment.map((comment) => <div className="rounded-md border p-3 text-sm" key={comment.id}><div className="flex justify-between gap-3"><p className="font-medium">{comment.user.name ?? comment.user.email}</p><p className="text-xs text-slate-500">{comment.createdAt.toLocaleString()}</p></div><p className="mt-2 whitespace-pre-wrap text-slate-700">{comment.body}</p></div>)}{!task.taskcomment.length ? <p className="text-sm text-slate-500">No comments yet.</p> : null}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Activity</CardTitle></CardHeader><CardContent className="space-y-3">{auditLogs.map((log) => <div className="rounded-md border p-3 text-sm" key={log.id}><div className="flex justify-between gap-3"><p className="font-medium">{log.action}</p><p className="text-xs text-slate-500">{log.createdAt.toLocaleString()}</p></div><p className="mt-1 text-xs text-slate-500">{log.user?.name ?? log.user?.email ?? "System"}</p></div>)}{!auditLogs.length ? <p className="text-sm text-slate-500">No activity yet.</p> : null}</CardContent></Card>
    </div>
  </main>;
}

function Item({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium uppercase text-slate-500">{label}</p><p className="mt-1">{value}</p></div>; }
function LinkRow({ label, value, href }: { label: string; value: string; href: string }) { return <div><p className="text-xs font-medium uppercase text-slate-500">{label}</p><Link className="mt-1 inline-block font-medium text-cyan-700 hover:underline" href={href}>{value}</Link></div>; }
