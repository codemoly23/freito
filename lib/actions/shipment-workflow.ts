"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { createUserNotification } from "@/lib/notifications/create-notification";
import { safelyCreateUserDeliveries } from "@/lib/notifications/templates";
import { ensureModuleAccess } from "@/lib/access/company-access";
import {
  shipmentWorkflowAssignmentSchema,
  shipmentWorkflowStepUpdateSchema,
} from "@/lib/validators/shipments";
import { createWorkflowSteps } from "@/lib/shipments/workflow";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  revalidateAdminPaths,
  successState,
  validationError,
} from "@/lib/actions/helpers";
import { branchScopeWhere, getCurrentBranchScope } from "@/lib/access/branch-access";

async function getScopedShipment(shipmentJobId: string, companyId: string) {
  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  return prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    select: {
      id: true,
      companyId: true,
      jobNo: true,
      serviceScope: true,
      deliveredAt: true,
      proofOfDeliveryAt: true,
      closedAt: true,
      commercialStatus: true,
      operationsStatus: true,
      documentStatus: true,
      financialStatus: true,
    },
  });
}

async function getScopedStep(
  workflowStepId: string,
  shipmentJobId: string,
  companyId: string,
) {
  return prisma.shipmentworkflowstep.findFirst({
    where: {
      id: workflowStepId,
      shipmentJobId,
      companyId,
      deletedAt: null,
      shipmentjob: { companyId, deletedAt: null },
    },
  });
}

export async function generateShipmentWorkflow(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("shipmentWorkflow:update");
  const shipmentJobId = getString(formData, "shipmentJobId");
  const shipment = await getScopedShipment(shipmentJobId, companyId);
  if (!shipment) return validationError("Shipment was not found.");

  const moduleError = await ensureModuleAccess(companyId, "SHIPMENTS");
  if (moduleError) return validationError(moduleError);

  const allExistingSteps = await prisma.shipmentworkflowstep.findMany({
    where: { companyId, shipmentJobId },
    select: { status: true, deletedAt: true },
  });
  const activeSteps = allExistingSteps.filter((step) => !step.deletedAt);
  if (activeSteps.some((step) => step.status === "COMPLETED")) {
    return validationError(
      "Workflow already started; manual update required. Completed workflow steps were preserved.",
    );
  }

  const stepCount = await prisma.$transaction(async (tx) => {
    if (allExistingSteps.length) {
      await tx.shipmentworkflowstep.deleteMany({
        where: { companyId, shipmentJobId },
      });
    }
    return createWorkflowSteps({
      tx,
      companyId,
      shipmentJobId,
      serviceScope: shipment.serviceScope,
      actorId: user.id,
    });
  });

  await audit({
    companyId,
    actorId: user.id,
    action: allExistingSteps.length
      ? "SHIPMENT_WORKFLOW_REGENERATED"
      : "SHIPMENT_WORKFLOW_GENERATED",
    entityType: "ShipmentJob",
    entityId: shipment.id,
    metadata: {
      shipmentJobId: shipment.id,
      jobNo: shipment.jobNo,
      serviceScope: shipment.serviceScope,
      stepCount,
    },
  });

  revalidateAdminPaths();
  return successState(
    allExistingSteps.length
      ? `Workflow regenerated with ${stepCount} steps.`
      : `Workflow generated with ${stepCount} steps.`,
  );
}

export async function updateShipmentWorkflowStep(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("shipmentWorkflow:update");
  const parsed = shipmentWorkflowStepUpdateSchema.safeParse({
    shipmentJobId: getString(formData, "shipmentJobId"),
    workflowStepId: getString(formData, "workflowStepId"),
    status: getString(formData, "status"),
    dueDate: getString(formData, "dueDate"),
    notes: getString(formData, "notes"),
  });
  if (!parsed.success) {
    return validationError(
      "Please fix the workflow step fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const [shipment, step] = await Promise.all([
    getScopedShipment(parsed.data.shipmentJobId, companyId),
    getScopedStep(
      parsed.data.workflowStepId,
      parsed.data.shipmentJobId,
      companyId,
    ),
  ]);
  if (!shipment || !step) return validationError("Workflow step was not found.");

  const moduleError = await ensureModuleAccess(companyId, "SHIPMENTS");
  if (moduleError) return validationError(moduleError);

  const now = new Date();
  const statusChanged = step.status !== parsed.data.status;
  const shipmentDates: {
    deliveredAt?: Date;
    proofOfDeliveryAt?: Date;
    closedAt?: Date;
  } = {};
  if (parsed.data.status === "COMPLETED") {
    if (step.stepKey === "DELIVERED_TO_CONSIGNEE" && !shipment.deliveredAt) {
      shipmentDates.deliveredAt = now;
    }
    if (
      step.stepKey === "PROOF_OF_DELIVERY_UPLOADED" &&
      !shipment.proofOfDeliveryAt
    ) {
      shipmentDates.proofOfDeliveryAt = now;
    }
    if (step.stepKey === "SHIPMENT_CLOSED" && !shipment.closedAt) {
      shipmentDates.closedAt = now;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedStep = await tx.shipmentworkflowstep.update({
      where: { id: step.id },
      data: {
        status: parsed.data.status,
        dueDate: parsed.data.dueDate,
        notes: parsed.data.notes,
        startedAt:
          parsed.data.status === "IN_PROGRESS" && !step.startedAt
            ? now
            : step.startedAt,
        completedAt:
          parsed.data.status === "COMPLETED" ? step.completedAt ?? now : null,
        updatedById: user.id,
        updatedAt: now,
      },
    });
    if (Object.keys(shipmentDates).length) {
      await tx.shipmentjob.update({
        where: { id: shipment.id },
        data: { ...shipmentDates, updatedAt: now },
      });
    }
    return updatedStep;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: statusChanged
      ? "SHIPMENT_WORKFLOW_STEP_STATUS_CHANGED"
      : "SHIPMENT_WORKFLOW_STEP_UPDATED",
    entityType: "ShipmentWorkflowStep",
    entityId: step.id,
    metadata: {
      shipmentJobId: shipment.id,
      jobNo: shipment.jobNo,
      stepKey: step.stepKey,
      fromStatus: step.status,
      toStatus: updated.status,
    },
  });

  revalidateAdminPaths();
  return successState("Workflow step updated.");
}

export async function assignShipmentWorkflowStep(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("shipmentWorkflow:assign");
  const parsed = shipmentWorkflowAssignmentSchema.safeParse({
    shipmentJobId: getString(formData, "shipmentJobId"),
    workflowStepId: getString(formData, "workflowStepId"),
    handlerType: getString(formData, "handlerType") || null,
    assignedUserId: getString(formData, "assignedUserId"),
    vendorId: getString(formData, "vendorId"),
  });
  if (!parsed.success) {
    return validationError(
      "Please select a valid workflow handler.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const [shipment, step] = await Promise.all([
    getScopedShipment(parsed.data.shipmentJobId, companyId),
    getScopedStep(
      parsed.data.workflowStepId,
      parsed.data.shipmentJobId,
      companyId,
    ),
  ]);
  if (!shipment || !step) return validationError("Workflow step was not found.");

  const moduleError = await ensureModuleAccess(companyId, "SHIPMENTS");
  if (moduleError) return validationError(moduleError);

  const isInternal = parsed.data.handlerType === "INTERNAL_EMPLOYEE";
  const [assignedUser, vendor] = await Promise.all([
    isInternal
      ? prisma.user.findFirst({
          where: {
            id: parsed.data.assignedUserId ?? "",
            companyId,
            scope: "COMPANY",
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true, name: true },
        })
      : null,
    parsed.data.handlerType && !isInternal
      ? prisma.vendor.findFirst({
          where: {
            id: parsed.data.vendorId ?? "",
            companyId,
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true, name: true },
        })
      : null,
  ]);

  if (isInternal && !assignedUser) {
    return validationError("Assigned employee must belong to the current company.", {
      assignedUserId: ["Select a valid employee from this company."],
    });
  }
  if (parsed.data.handlerType && !isInternal && !vendor) {
    return validationError("Vendor or agent must belong to the current company.", {
      vendorId: ["Select a valid vendor from this company."],
    });
  }

  await prisma.shipmentworkflowstep.update({
    where: { id: step.id },
    data: {
      handlerType: parsed.data.handlerType,
      assignedUserId: isInternal ? assignedUser?.id : null,
      vendorId: isInternal ? null : vendor?.id,
      updatedById: user.id,
      updatedAt: new Date(),
    },
  });

  if (assignedUser) {
    const notification = await createUserNotification({
      companyId,
      userId: assignedUser.id,
      type: "WORKFLOW_STEP_ASSIGNED",
      title: "Workflow Step Assigned",
      message: `${step.title} was assigned to you for shipment ${shipment.jobNo}.`,
      linkUrl: `/dashboard/shipments/${shipment.id}#operations-workflow`,
      metadata: {
        shipmentJobId: shipment.id,
        workflowStepId: step.id,
        stepKey: step.stepKey,
      },
    });
    await safelyCreateUserDeliveries({
      companyId,
      userId: assignedUser.id,
      key: "workflow_step_assigned",
      variables: {
        shipmentNumber: shipment.jobNo,
        status: "ASSIGNED",
        linkUrl: `/dashboard/shipments/${shipment.id}#operations-workflow`,
      },
      linkUrl: `/dashboard/shipments/${shipment.id}#operations-workflow`,
      notificationId: notification.id,
    });
  }

  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_WORKFLOW_STEP_ASSIGNED",
    entityType: "ShipmentWorkflowStep",
    entityId: step.id,
    metadata: {
      shipmentJobId: shipment.id,
      jobNo: shipment.jobNo,
      stepKey: step.stepKey,
      handlerType: parsed.data.handlerType,
      assignedUserId: assignedUser?.id ?? null,
      vendorId: vendor?.id ?? null,
    },
  });

  revalidateAdminPaths();
  return successState("Workflow handler assigned.");
}

export async function deleteShipmentWorkflowStep(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("shipmentWorkflow:delete");
  const shipmentJobId = getString(formData, "shipmentJobId");
  const workflowStepId = getString(formData, "workflowStepId");
  const [shipment, step] = await Promise.all([
    getScopedShipment(shipmentJobId, companyId),
    getScopedStep(workflowStepId, shipmentJobId, companyId),
  ]);
  if (!shipment || !step) return;
  if (await ensureModuleAccess(companyId, "SHIPMENTS")) return;

  await prisma.shipmentworkflowstep.update({
    where: { id: step.id },
    data: { deletedAt: new Date(), updatedById: user.id, updatedAt: new Date() },
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_WORKFLOW_STEP_DELETED",
    entityType: "ShipmentWorkflowStep",
    entityId: step.id,
    metadata: {
      shipmentJobId: shipment.id,
      jobNo: shipment.jobNo,
      stepKey: step.stepKey,
    },
  });
  revalidateAdminPaths();
}

export async function initShipmentWorkflowInternal(
  tx: Prisma.TransactionClient,
  shipmentJobId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _companyId: string
) {
  const shipment = await tx.shipmentjob.findUnique({
    where: { id: shipmentJobId },
    select: {
      transportMode: true,
      shipmentType: true,
      loadType: true,
      serviceScope: true,
    },
  });
  if (!shipment) return;

  const template = await tx.workflowtemplate.findFirst({
    where: {
      companyId: null,
      mode: shipment.transportMode,
      direction: shipment.shipmentType,
      loadType: shipment.loadType,
      serviceScope: shipment.serviceScope,
    },
    include: {
      workflowstagetemplate: {
        include: { workflowstagerequirement: true },
      },
    },
  });

  if (!template) {
    console.error("No matching workflow template found for shipment", shipmentJobId, shipment);
    return;
  }

  const now = new Date();
  const workflow = await tx.shipmentworkflow.create({
    data: {
      id: randomUUID(),
      shipmentJobId,
      workflowTemplateId: template.id,
      progressPercent: 0,
      updatedAt: now,
    },
  });

  for (const stageTemplate of template.workflowstagetemplate) {
    const stage = await tx.shipmentworkflowstage.create({
      data: {
        id: randomUUID(),
        shipmentWorkflowId: workflow.id,
        stageCode: stageTemplate.stageCode,
        stageName: stageTemplate.stageName,
        sortOrder: stageTemplate.sortOrder,
        status: stageTemplate.stageCode === "QUERY_RECEIVED" ? "COMPLETED" : "NOT_STARTED",
        completedAt: stageTemplate.stageCode === "QUERY_RECEIVED" ? now : null,
        updatedAt: now,
      },
    });

    if (stageTemplate.workflowstagerequirement.length > 0) {
      await tx.workflowstagerequirement.createMany({
        data: stageTemplate.workflowstagerequirement.map((req) => ({
          id: randomUUID(),
          shipmentWorkflowStageId: stage.id,
          type: req.type,
          target: req.target,
          description: req.description,
          isFulfilled: false,
          updatedAt: now,
        })),
      });
    }
  }
}

export async function recalculateShipmentWorkflowInternal(
  tx: Prisma.TransactionClient,
  shipmentId: string
) {
  const workflow = await tx.shipmentworkflow.findUnique({
    where: { shipmentJobId: shipmentId },
    include: {
      shipmentworkflowstage: {
        orderBy: { sortOrder: "asc" },
        include: { workflowstagerequirement: true },
      },
      workflowoverride: true,
    },
  });

  if (!workflow) return;

  const stages = workflow.shipmentworkflowstage.map((s) => ({
    ...s,
    requirements: s.workflowstagerequirement,
  }));
  const overrides = workflow.workflowoverride;

  const shipment = await tx.shipmentjob.findUnique({
    where: { id: shipmentId },
    include: {
      prealert: true,
      billoflading: true,
      invoice: { where: { deletedAt: null } },
      vendorbill: { where: { deletedAt: null } },
    },
  });
  if (!shipment) return;

  const docs = await tx.shipmentdocument.findMany({
    where: { shipmentJobId: shipmentId, deletedAt: null, status: "VERIFIED" },
    include: { documentchecklistitem: true },
  });

  const generatedDocs = await tx.freightdocument.findMany({
    where: { shipmentJobId: shipmentId, deletedAt: null },
  });

  const reqUpdates: { id: string; isFulfilled: boolean; fulfilledAt: Date | null }[] = [];
  
  for (const stage of stages) {
    for (const req of stage.requirements) {
      let isFulfilled = false;
      
      if (req.type === "FIELD") {
        if (req.target === "destinationAgentId") {
          isFulfilled = !!shipment.prealert?.destinationAgentId;
        } else {
          const val = (shipment as Record<string, unknown>)[req.target];
          isFulfilled = val !== undefined && val !== null && val !== "";
        }
      } else if (req.type === "DOCUMENT") {
        const targetClean = req.target.toUpperCase().replace("-", "_");
        const docTypes = ["HBL", "HAWB", "MANIFEST", "DEBIT_NOTE"];
        let isGenDoc = false;
        let genDocFulfilled = false;
        for (const type of docTypes) {
          if (targetClean.startsWith(type)) {
            isGenDoc = true;
            const statusSuffix = targetClean.substring(type.length).replace(/^[^A-Z]+|[^A-Z]+$/g, "");
            const requiredStatus = statusSuffix || "LOCKED";
            genDocFulfilled = generatedDocs.some(d => 
              d.type === type && 
              (d.status === requiredStatus || (requiredStatus === "APPROVED" && d.status === "LOCKED"))
            );
            break;
          }
        }

        if (isGenDoc) {
          isFulfilled = genDocFulfilled;
        } else if (["DELIVERY_ORDER", "CUSTOMS_RELEASE", "GATE_PASS", "POD"].includes(targetClean)) {
          if (targetClean === "DELIVERY_ORDER") {
            isFulfilled = generatedDocs.some(d =>
              d.type === "DELIVERY_ORDER" &&
              (d.status === "RECEIVED" || d.status === "VERIFIED")
            );
          } else if (targetClean === "CUSTOMS_RELEASE") {
            if (shipment.shipmentType === "IMPORT") {
              isFulfilled = generatedDocs.some(d =>
                (d.type === "CUSTOMS_RELEASE" || d.type === "BILL_OF_ENTRY") &&
                (d.status === "RECEIVED" || d.status === "VERIFIED")
              );
            } else {
              isFulfilled = generatedDocs.some(d =>
                (d.type === "CUSTOMS_RELEASE" || d.type === "EXPORT_DECLARATION") &&
                (d.status === "RECEIVED" || d.status === "VERIFIED")
              );
            }
          } else if (targetClean === "GATE_PASS") {
            isFulfilled = generatedDocs.some(d =>
              d.type === "GATE_PASS" &&
              (d.status === "RECEIVED" || d.status === "VERIFIED")
            );
          } else if (targetClean === "POD") {
            const deliveryRequired = shipment.serviceScope === "PORT_TO_DOOR" || shipment.serviceScope === "DOOR_TO_DOOR";
            if (!deliveryRequired) {
              isFulfilled = true;
            } else {
              isFulfilled = generatedDocs.some(d =>
                (d.type === "POD" || d.type === "DELIVERY_CHALLAN") &&
                d.status === "VERIFIED"
              );
            }
          }
        } else {
          isFulfilled = docs.some(d => d.documentName === req.target || d.documentchecklistitem?.name === req.target);
        }
      } else if (req.type === "APPROVAL") {
        if (req.target === "CUSTOMER_APPROVED_DRAFT") {
          isFulfilled = shipment.billoflading?.approvalStatus === "APPROVED_BY_CUSTOMER" || shipment.billoflading?.approvalStatus === "FINAL_LOCKED";
        }
      } else if (req.type === "PREVIOUS_STAGE") {
        const prevStage = stages.find(s => s.stageCode === req.target);
        const isOverridden = overrides.some(o => o.stageCode === req.target);
        isFulfilled = prevStage?.status === "COMPLETED" || isOverridden;
      } else if (req.type === "FINANCIAL") {
        if (req.target === "INVOICES_PAID") {
          const activeInvoices = shipment.invoice.filter(inv => inv.status !== "CANCELLED");
          isFulfilled = activeInvoices.length > 0 && activeInvoices.every(inv => Number(inv.dueAmount) <= 0);
        } else if (req.target === "VENDOR_BILLS_PAID") {
          const activeBills = shipment.vendorbill.filter(bill => bill.status !== "CANCELLED");
          isFulfilled = activeBills.length > 0 && activeBills.every(bill => Number(bill.dueAmount) <= 0);
        }
      }

      reqUpdates.push({
        id: req.id,
        isFulfilled,
        fulfilledAt: isFulfilled ? (req.fulfilledAt || new Date()) : null,
      });
      req.isFulfilled = isFulfilled;
    }
  }

  const now = new Date();
  for (const update of reqUpdates) {
    await tx.workflowstagerequirement.update({
      where: { id: update.id },
      data: {
        isFulfilled: update.isFulfilled,
        fulfilledAt: update.fulfilledAt,
        updatedAt: now,
      },
    });
  }

  let blockedCount = 0;
  let completedCount = 0;
  const missingReqs: string[] = [];
  let currentStageCode: string | null = null;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const isOverridden = overrides.some(o => o.stageCode === stage.stageCode);
    
    const prevStageReqs = stage.requirements.filter(r => r.type === "PREVIOUS_STAGE");
    const prevStagesOk = prevStageReqs.every(r => {
      const prev = stages.find(s => s.stageCode === r.target);
      return prev?.status === "COMPLETED" || overrides.some(o => o.stageCode === r.target);
    });

    const otherReqs = stage.requirements.filter(r => r.type !== "PREVIOUS_STAGE");
    const otherReqsOk = otherReqs.every(r => r.isFulfilled);

    let newStatus = stage.status;

    if (isOverridden) {
      newStatus = "COMPLETED";
    } else {
      if (!prevStagesOk) {
        if (stage.status === "COMPLETED") {
          newStatus = "PENDING";
        } else if (stage.status !== "NOT_STARTED") {
          newStatus = "PENDING";
        }
      } else {
        if (otherReqsOk) {
          if (stage.status === "BLOCKED" || stage.status === "NOT_STARTED" || stage.status === "PENDING") {
            newStatus = "IN_PROGRESS";
          }
        } else {
          if (stage.status === "COMPLETED") {
            newStatus = "BLOCKED";
          }
        }
      }
    }

    if (!currentStageCode && newStatus !== "COMPLETED" && newStatus !== "SKIPPED" && newStatus !== "NOT_APPLICABLE") {
      currentStageCode = stage.stageCode;
      if (!otherReqsOk && !isOverridden && prevStagesOk) {
        newStatus = "BLOCKED";
      }
      
      for (const r of stage.requirements) {
        if (!r.isFulfilled) {
          missingReqs.push(r.description);
        }
      }
    }

    if (newStatus === "BLOCKED") {
      blockedCount++;
    }
    if (newStatus === "COMPLETED") {
      completedCount++;
    }

    if (newStatus !== stage.status) {
      await tx.shipmentworkflowstage.update({
        where: { id: stage.id },
        data: {
          status: newStatus,
          blockedReason: newStatus === "BLOCKED" ? missingReqs.join(", ") : null,
          completedAt: newStatus === "COMPLETED" ? (stage.completedAt || new Date()) : null,
          updatedAt: now,
        },
      });
      
      await tx.workflowstageaudit.create({
        data: {
          id: randomUUID(),
          shipmentWorkflowId: workflow.id,
          stageCode: stage.stageCode,
          action: "STATUS_RECALCULATED",
          previousStatus: stage.status,
          newStatus,
          remarks: `Auto recalculated status. Missing reqs: ${missingReqs.join(", ")}`,
        },
      });
    }
  }

  const progressPercent = Math.round((completedCount / stages.length) * 100);

  await tx.shipmentworkflow.update({
    where: { id: workflow.id },
    data: { progressPercent, updatedAt: now },
  });

  let commercialStatus = shipment.commercialStatus;
  let operationsStatus = shipment.operationsStatus;
  let documentStatus = shipment.documentStatus;
  let financialStatus = shipment.financialStatus;

  if (currentStageCode) {
    if (["QUERY_RECEIVED", "RATE_SOURCING", "QUOTATION_SENT"].includes(currentStageCode)) {
      commercialStatus = "QUOTATION_PENDING";
    } else if (currentStageCode === "QUOTATION_ACCEPTED") {
      commercialStatus = "QUOTATION_ACCEPTED";
    } else if (["INVOICE_ISSUED", "PAYMENT_RECEIVED", "VENDOR_BILLS_CLOSED", "FINANCIALLY_CLOSED"].includes(currentStageCode)) {
      commercialStatus = "BILLING_IN_PROGRESS";
    }

    if (["JOB_FILE_OPENED", "BOOKING_REQUESTED", "BOOKING_CONFIRMED"].includes(currentStageCode)) {
      operationsStatus = "BOOKING_PENDING";
    } else if (["CARGO_PICKUP_SCHEDULED", "CARGO_RECEIVED"].includes(currentStageCode)) {
      operationsStatus = "CARGO_HANDOVER";
    } else if (["EXPORT_CUSTOMS_PROCESSING", "EXPORT_CUSTOMS_CLEARED"].includes(currentStageCode)) {
      operationsStatus = "CUSTOMS_CLEARANCE";
    } else if (["DEPARTED", "IN_TRANSIT"].includes(currentStageCode)) {
      operationsStatus = "IN_TRANSIT";
    } else if (["ARRIVED_AT_DESTINATION", "IMPORT_CLEARANCE"].includes(currentStageCode)) {
      operationsStatus = "ARRIVED";
    } else if (["DELIVERY_ORDER_RELEASE", "OUT_FOR_DELIVERY", "DELIVERED"].includes(currentStageCode)) {
      operationsStatus = "DELIVERED";
    }

    if (["SI_SUBMITTED", "DRAFT_BL_AWB_CREATED", "DRAFT_SENT_TO_CUSTOMER"].includes(currentStageCode)) {
      documentStatus = "DRAFT_PENDING";
    } else if (currentStageCode === "CUSTOMER_APPROVED_DRAFT") {
      documentStatus = "DRAFT_APPROVED";
    } else if (["FINAL_BL_AWB_LOCKED", "MANIFEST_PREPARED"].includes(currentStageCode)) {
      documentStatus = "FINAL_LOCKED";
    }

    if (currentStageCode === "INVOICE_ISSUED") {
      financialStatus = "INVOICED";
    } else if (currentStageCode === "PAYMENT_RECEIVED") {
      financialStatus = "PAYMENT_RECEIVED";
    } else if (currentStageCode === "VENDOR_BILLS_CLOSED") {
      financialStatus = "PAYABLES_SETTLED";
    } else if (currentStageCode === "FINANCIALLY_CLOSED") {
      financialStatus = "FINANCIALLY_CLOSED";
    }
  } else {
    commercialStatus = "CLOSED";
    operationsStatus = "DELIVERED";
    documentStatus = "CLOSED";
    financialStatus = "CLOSED";
  }

  await tx.shipmentjob.update({
    where: { id: shipmentId },
    data: {
      commercialStatus,
      operationsStatus,
      documentStatus,
      financialStatus,
      workflowProgressPercent: progressPercent,
      currentStageCode: currentStageCode || "JOB_CLOSED",
      blockedStageCount: blockedCount,
      missingRequirementList: missingReqs.join(", "),
      updatedAt: now,
    },
  });
}

export async function recalculateShipmentWorkflow(shipmentId: string) {
  await prisma.$transaction(async (tx) => {
    await recalculateShipmentWorkflowInternal(tx, shipmentId);
  });
}

export async function transitionWorkflowStageAction(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const shipmentJobId = getString(formData, "shipmentJobId");
  const stageCode = getString(formData, "stageCode");
  const toStatus = getString(formData, "status") as "COMPLETED" | "IN_PROGRESS" | "SKIPPED";

  const { user, companyId } = await getScopedCompanyId("shipmentWorkflow:update");
  const shipment = await getScopedShipment(shipmentJobId, companyId);
  if (!shipment) return validationError("Shipment was not found.");

  const result = await prisma.$transaction(async (tx) => {
    const workflow = await tx.shipmentworkflow.findUnique({
      where: { shipmentJobId },
      include: {
        shipmentworkflowstage: {
          include: { workflowstagerequirement: true }
        },
        workflowoverride: true,
      }
    });

    if (!workflow) {
      return { error: "Workflow not initialized for this shipment." };
    }

    const stages = workflow.shipmentworkflowstage.map((s) => ({
      ...s,
      requirements: s.workflowstagerequirement,
    }));
    const stage = stages.find(s => s.stageCode === stageCode);
    if (!stage) {
      return { error: "Workflow stage not found." };
    }

    if (toStatus === "COMPLETED") {
      const fullShipment = await tx.shipmentjob.findUnique({
        where: { id: shipmentJobId },
        include: {
          prealert: true,
          billoflading: true,
          invoice: { where: { deletedAt: null } },
          vendorbill: { where: { deletedAt: null } },
        },
      });

      const docs = await tx.shipmentdocument.findMany({
        where: { shipmentJobId, deletedAt: null, status: "VERIFIED" },
        include: { documentchecklistitem: true },
      });

      const generatedDocs = await tx.freightdocument.findMany({
        where: { shipmentJobId, deletedAt: null },
      });

      const missing: string[] = [];

      for (const req of stage.requirements) {
        let isFulfilled = false;
        if (req.type === "FIELD") {
          if (req.target === "destinationAgentId") {
            isFulfilled = !!fullShipment?.prealert?.destinationAgentId;
          } else {
            const val = (fullShipment as Record<string, unknown>)[req.target];
            isFulfilled = val !== undefined && val !== null && val !== "";
          }
        } else if (req.type === "DOCUMENT") {
          const targetClean = req.target.toUpperCase().replace("-", "_");
          const docTypes = ["HBL", "HAWB", "MANIFEST", "DEBIT_NOTE"];
          let isGenDoc = false;
          let genDocFulfilled = false;
          for (const type of docTypes) {
            if (targetClean.startsWith(type)) {
              isGenDoc = true;
              const statusSuffix = targetClean.substring(type.length).replace(/^[^A-Z]+|[^A-Z]+$/g, "");
              const requiredStatus = statusSuffix || "LOCKED";
              genDocFulfilled = generatedDocs.some(d => 
                d.type === type && 
                (d.status === requiredStatus || (requiredStatus === "APPROVED" && d.status === "LOCKED"))
              );
              break;
            }
          }

          if (isGenDoc) {
            isFulfilled = genDocFulfilled;
          } else if (["DELIVERY_ORDER", "CUSTOMS_RELEASE", "GATE_PASS", "POD"].includes(targetClean)) {
            if (targetClean === "DELIVERY_ORDER") {
              isFulfilled = generatedDocs.some(d =>
                d.type === "DELIVERY_ORDER" &&
                (d.status === "RECEIVED" || d.status === "VERIFIED")
              );
            } else if (targetClean === "CUSTOMS_RELEASE") {
              if (fullShipment?.shipmentType === "IMPORT") {
                isFulfilled = generatedDocs.some(d =>
                  (d.type === "CUSTOMS_RELEASE" || d.type === "BILL_OF_ENTRY") &&
                  (d.status === "RECEIVED" || d.status === "VERIFIED")
                );
              } else {
                isFulfilled = generatedDocs.some(d =>
                  (d.type === "CUSTOMS_RELEASE" || d.type === "EXPORT_DECLARATION") &&
                  (d.status === "RECEIVED" || d.status === "VERIFIED")
                );
              }
            } else if (targetClean === "GATE_PASS") {
              isFulfilled = generatedDocs.some(d =>
                d.type === "GATE_PASS" &&
                (d.status === "RECEIVED" || d.status === "VERIFIED")
              );
            } else if (targetClean === "POD") {
              const deliveryRequired = fullShipment?.serviceScope === "PORT_TO_DOOR" || fullShipment?.serviceScope === "DOOR_TO_DOOR";
              if (!deliveryRequired) {
                isFulfilled = true;
              } else {
                isFulfilled = generatedDocs.some(d =>
                  (d.type === "POD" || d.type === "DELIVERY_CHALLAN") &&
                  d.status === "VERIFIED"
                );
              }
            }
          } else {
            isFulfilled = docs.some(d => d.documentName === req.target || d.documentchecklistitem?.name === req.target);
          }
        } else if (req.type === "APPROVAL") {
          if (req.target === "CUSTOMER_APPROVED_DRAFT") {
            isFulfilled = fullShipment?.billoflading?.approvalStatus === "APPROVED_BY_CUSTOMER" || fullShipment?.billoflading?.approvalStatus === "FINAL_LOCKED";
          }
        } else if (req.type === "PREVIOUS_STAGE") {
          const prev = workflow.shipmentworkflowstage.find(s => s.stageCode === req.target);
          const isOverridden = workflow.workflowoverride.some(o => o.stageCode === req.target);
          isFulfilled = prev?.status === "COMPLETED" || isOverridden;
        } else if (req.type === "FINANCIAL") {
          if (req.target === "INVOICES_PAID") {
            const activeInvoices = fullShipment?.invoice.filter(inv => inv.status !== "CANCELLED") || [];
            isFulfilled = activeInvoices.length > 0 && activeInvoices.every(inv => Number(inv.dueAmount) <= 0);
          } else if (req.target === "VENDOR_BILLS_PAID") {
            const activeBills = fullShipment?.vendorbill.filter(bill => bill.status !== "CANCELLED") || [];
            isFulfilled = activeBills.length > 0 && activeBills.every(bill => Number(bill.dueAmount) <= 0);
          }
        }

        if (!isFulfilled) {
          missing.push(req.description);
        }
      }

      if (missing.length > 0) {
        return { error: `Cannot complete stage: ${missing.join(", ")}` };
      }
    }

    const now = new Date();
    await tx.shipmentworkflowstage.update({
      where: { id: stage.id },
      data: {
        status: toStatus,
        completedById: toStatus === "COMPLETED" ? user.id : null,
        completedAt: toStatus === "COMPLETED" ? now : null,
        blockedReason: null,
        updatedAt: now,
      }
    });

    await tx.workflowstageaudit.create({
      data: {
        id: randomUUID(),
        shipmentWorkflowId: workflow.id,
        stageCode,
        action: "STAGE_TRANSITION",
        previousStatus: stage.status,
        newStatus: toStatus,
        actorId: user.id,
        remarks: `Manual transition to ${toStatus}`,
      }
    });

    await tx.workflowstagetransition.create({
      data: {
        id: randomUUID(),
        shipmentWorkflowId: workflow.id,
        fromStageCode: stage.status === "COMPLETED" ? null : stage.stageCode,
        toStageCode: stageCode,
        triggeredById: user.id,
      }
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);

    return { success: true };
  });

  if (result.error) {
    return validationError(result.error);
  }

  revalidateAdminPaths();
  return successState("Workflow stage updated.");
}

export async function overrideWorkflowStageAction(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const shipmentJobId = getString(formData, "shipmentJobId");
  const stageCode = getString(formData, "stageCode");
  const reason = getString(formData, "reason").trim();

  if (!reason) {
    return validationError("Reason for override is required.");
  }

  const { user, companyId } = await getScopedCompanyId("shipmentWorkflow:update");
  const shipment = await getScopedShipment(shipmentJobId, companyId);
  if (!shipment) return validationError("Shipment was not found.");

  const userRoles = await prisma.userrole.findMany({
    where: { userId: user.id },
    include: { role: true },
  });
  const isAdminOrManager = userRoles.some(ur => ur.role.code === "COMPANY_ADMIN" || ur.role.code === "OPERATIONS_MANAGER");
  if (!isAdminOrManager) {
    return validationError("Only managers and admins can override workflow stages.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const workflow = await tx.shipmentworkflow.findUnique({
      where: { shipmentJobId },
      include: {
        shipmentworkflowstage: true
      }
    });

    if (!workflow) {
      return { error: "Workflow not initialized." };
    }

    const stage = workflow.shipmentworkflowstage.find(s => s.stageCode === stageCode);
    if (!stage) {
      return { error: "Stage not found." };
    }

    const now = new Date();
    await tx.workflowoverride.create({
      data: {
        id: randomUUID(),
        shipmentWorkflowId: workflow.id,
        stageCode,
        reason,
        overriddenById: user.id,
      }
    });

    await tx.shipmentworkflowstage.update({
      where: { id: stage.id },
      data: {
        status: "COMPLETED",
        completedById: user.id,
        completedAt: now,
        blockedReason: null,
        updatedAt: now,
      }
    });

    await tx.workflowstageaudit.create({
      data: {
        id: randomUUID(),
        shipmentWorkflowId: workflow.id,
        stageCode,
        action: "OVERRIDDEN",
        previousStatus: stage.status,
        newStatus: "COMPLETED",
        actorId: user.id,
        remarks: `Overridden. Reason: ${reason}`,
      }
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);

    return { success: true };
  });

  if (result.error) {
    return validationError(result.error);
  }

  revalidateAdminPaths();
  return successState("Workflow stage overridden.");
}

export async function getOrCreateShipmentWorkflow(shipmentJobId: string, companyId: string) {
  return prisma.$transaction(async (tx) => {
    const includeSpec = {
      shipmentworkflowstage: {
        orderBy: { sortOrder: "asc" as const },
        include: {
          workflowstagerequirement: true,
          user: { select: { id: true, name: true } },
        },
      },
      workflowoverride: {
        include: { user: { select: { id: true, name: true } } },
      },
      workflowstageaudit: {
        orderBy: { createdAt: "desc" as const },
        include: { user: { select: { id: true, name: true } } },
      },
    };

    let rawWorkflow = await tx.shipmentworkflow.findUnique({
      where: { shipmentJobId },
      include: includeSpec,
    });

    if (!rawWorkflow) {
      await initShipmentWorkflowInternal(tx, shipmentJobId, companyId);
      rawWorkflow = await tx.shipmentworkflow.findUnique({
        where: { shipmentJobId },
        include: includeSpec,
      });
      if (rawWorkflow) {
        await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
        rawWorkflow = await tx.shipmentworkflow.findUnique({
          where: { shipmentJobId },
          include: includeSpec,
        });
      }
    }

    if (!rawWorkflow) return null;

    return {
      ...rawWorkflow,
      stages: rawWorkflow.shipmentworkflowstage.map((s) => ({
        ...s,
        requirements: s.workflowstagerequirement,
        completedBy: s.user,
      })),
      overrides: rawWorkflow.workflowoverride.map((o) => ({
        ...o,
        overriddenBy: o.user,
      })),
      audits: rawWorkflow.workflowstageaudit.map((a) => ({
        ...a,
        actor: a.user,
      })),
    };
  });
}
