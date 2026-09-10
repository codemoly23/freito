import { TaskForm } from "@/components/forms/task-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireModuleAccess } from "@/lib/access/company-access";
import { saveTask } from "@/lib/actions/tasks";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { getTaskFormOptions } from "@/lib/tasks/page-data";

export default async function NewTaskPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("tasks:create");
  const companyId = user.companyId ?? "";
  await requireModuleAccess(companyId, "TASKS");
  const params = await searchParams;
  const options = await getTaskFormOptions(companyId);
  return <main className="space-y-6 p-4 lg:p-6"><div><h1 className="mt-3 text-2xl font-semibold">Create Task</h1></div><Card><CardHeader><CardTitle>Task information</CardTitle></CardHeader><CardContent><TaskForm action={saveTask} canAssign={hasPermission(user, "tasks:assign")} defaults={params} {...options} /></CardContent></Card></main>;
}
