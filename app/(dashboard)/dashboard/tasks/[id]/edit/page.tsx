import { notFound } from "next/navigation";
import { TaskForm } from "@/components/forms/task-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireModuleAccess } from "@/lib/access/company-access";
import { saveTask } from "@/lib/actions/tasks";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { getTaskFormOptions } from "@/lib/tasks/page-data";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("tasks:edit");
  const companyId = user.companyId ?? "";
  await requireModuleAccess(companyId, "TASKS");
  const { id } = await params;
  const [task, options] = await Promise.all([prisma.task.findFirst({ where: { id, companyId, deletedAt: null } }), getTaskFormOptions(companyId)]);
  if (!task) notFound();
  const formTask = { ...task, dueDate: task.dueDate?.toISOString().slice(0, 10) ?? "" };
  return <main className="space-y-6 p-4 lg:p-6"><h1 className="text-2xl font-semibold">Edit Task</h1><Card><CardHeader><CardTitle>{task.title}</CardTitle></CardHeader><CardContent><TaskForm action={saveTask} canAssign={hasPermission(user, "tasks:assign")} task={formTask} {...options} /></CardContent></Card></main>;
}
