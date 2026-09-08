import { TaskRecurrenceForm } from "@/components/forms/task-recurrence-forms";
import { requireModuleAccess } from "@/lib/access/company-access";
import { saveTaskRecurrence } from "@/lib/actions/task-recurrences";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { getTaskFormOptions } from "@/lib/tasks/page-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewTaskRecurrencePage() {
  const user = await requirePermission("tasks:create");
  const companyId = user.companyId ?? "";
  await requireModuleAccess(companyId, "TASKS");
  const options = await getTaskFormOptions(companyId);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 07</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">New recurring task</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recurrence details</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskRecurrenceForm action={saveTaskRecurrence} canAssign={hasPermission(user, "tasks:assign")} {...options} />
        </CardContent>
      </Card>
    </main>
  );
}
