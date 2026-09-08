import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { DocumentMasterManagerClient } from "./manager-client";

export default async function DocumentMasterSettingsPage() {
  const user = await requirePermission("branding:manage"); // Admin only

  const items = await prisma.documentchecklistitem.findMany({
    where: {
      OR: [
        { companyId: null },
        { companyId: user.companyId },
      ]
    },
    orderBy: [
      { companyId: "desc" }, // Company-specific first
      { sortOrder: "asc" }
    ]
  });

  const formattedItems = items.map(item => ({
    id: item.id,
    name: item.name,
    code: item.code || "",
    owner: item.owner,
    docCategory: item.docCategory,
    media: item.media,
    transportMode: item.transportMode,
    isOptional: item.isOptional,
    isRequired: item.isRequired,
    countryRestriction: item.countryRestriction,
    incotermRestriction: item.incotermRestriction,
    lcRequired: item.lcRequired,
    ttRequired: item.ttRequired,
    hazardousCargo: item.hazardousCargo,
    perishableCargo: item.perishableCargo,
    temperatureControlled: item.temperatureControlled,
    containerRequired: item.containerRequired,
    workflowStage: item.workflowStage,
    mandatoryBeforeJobClose: item.mandatoryBeforeJobClose,
    mandatoryBeforeInvoice: item.mandatoryBeforeInvoice,
    mandatoryBeforeDeliveryOrder: item.mandatoryBeforeDeliveryOrder,
    mandatoryBeforeFinanceClose: item.mandatoryBeforeFinanceClose,
    description: item.description,
    helpText: item.helpText,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    isGlobal: item.companyId === null
  }));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Document Master Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure dynamic checklist generators, compliance engines, and automated blocking conditions for shipment workflows.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Document Master Registry</CardTitle>
          <CardDescription>
            Configure required documents, owners, media scopes, transport modes, and mandatory validation checkpoints before key actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentMasterManagerClient initialItems={formattedItems} />
        </CardContent>
      </Card>
    </main>
  );
}
