import crypto from "crypto";
import type {
  Prisma,
  shipmentworkflowstep_serviceScope as ServiceScope,
} from "@/lib/generated/prisma/client";

export async function getWorkflowTemplates(
  tx: Prisma.TransactionClient,
  companyId: string,
  serviceScope: ServiceScope,
) {
  const companyTemplates = await tx.shipmentworkflowtemplatestep.findMany({
    where: { companyId, serviceScope, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (companyTemplates.length) return companyTemplates;

  return tx.shipmentworkflowtemplatestep.findMany({
    where: { companyId: null, serviceScope, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createWorkflowSteps({
  tx,
  companyId,
  shipmentJobId,
  serviceScope,
  actorId,
}: {
  tx: Prisma.TransactionClient;
  companyId: string;
  shipmentJobId: string;
  serviceScope: ServiceScope;
  actorId: string;
}) {
  const templates = await getWorkflowTemplates(tx, companyId, serviceScope);
  if (!templates.length) {
    throw new Error(`No active workflow template exists for ${serviceScope}.`);
  }

  const now = new Date();
  await tx.shipmentworkflowstep.createMany({
    data: templates.map((template) => ({
      id: crypto.randomUUID(),
      companyId,
      shipmentJobId,
      templateStepId: template.id,
      serviceScope,
      phase: template.phase,
      stepKey: template.stepKey,
      title: template.title,
      description: template.description,
      sortOrder: template.sortOrder,
      isRequired: template.isRequired,
      visibility: template.defaultVisibility,
      createdById: actorId,
      updatedById: actorId,
      updatedAt: now,
    })),
  });

  return templates.length;
}
