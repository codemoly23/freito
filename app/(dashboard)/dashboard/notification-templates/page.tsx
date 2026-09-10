import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toggleNotificationTemplate, toggleNotificationTemplateAutoSend } from "@/lib/actions/notification-templates";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";

export default async function NotificationTemplatesPage() {
  const user = await requirePermission("notificationTemplates:view");
  const companyId = user.companyId ?? "";
  const records = await prisma.notificationtemplate.findMany({
    where: {
      deletedAt: null,
      OR: [{ companyId }, { companyId: null, isSystem: true }],
    },
    orderBy: [{ key: "asc" }, { channel: "asc" }, { companyId: "desc" }],
  });
  const effectiveTemplates = [
    ...new Map(
      [...records.filter((template) => !template.companyId), ...records.filter((template) => template.companyId)]
        .map((template) => [`${template.key}:${template.channel}`, template]),
    ).values(),
  ];
  const canManage = hasPermission(user, "notificationTemplates:manage");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Notification Templates</h1>
        <p className="mt-1 text-sm text-slate-600">Customer-safe templates used to prepare future external deliveries.</p>
      </div>
      <section className="space-y-3">
        {effectiveTemplates.map((template) => (
          <Card key={template.id}>
            <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{template.name}</p>
                  <Badge variant={template.isActive ? "success" : "secondary"}>
                    {template.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="secondary">{template.channel}</Badge>
                  <Badge variant="secondary">{template.audienceScope}</Badge>
                  {template.autoSendApproved ? <Badge variant="success">Auto-send approved</Badge> : null}
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">{template.key}</p>
                {template.description ? <p className="mt-2 text-sm text-slate-600">{template.description}</p> : null}
                {template.subject ? <p className="mt-3 text-sm"><span className="font-medium">Subject:</span> {template.subject}</p> : null}
                <p className="mt-1 text-sm text-slate-600">{template.body}</p>
                {!template.autoSendApproved ? (
                  <p className="mt-2 text-xs text-slate-500">External sending for this template requires manual approval from the Delivery Outbox unless auto-send is approved below.</p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex flex-col gap-2">
                  <form action={toggleNotificationTemplate}>
                    <input name="templateId" type="hidden" value={template.id} />
                    <Button size="sm" type="submit" variant="outline">
                      {template.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                  <form action={toggleNotificationTemplateAutoSend}>
                    <input name="templateId" type="hidden" value={template.id} />
                    <Button size="sm" type="submit" variant="outline">
                      {template.autoSendApproved ? "Revoke auto-send" : "Approve auto-send"}
                    </Button>
                  </form>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
