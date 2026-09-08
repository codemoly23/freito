"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ensureModuleAccess } from "@/lib/access/company-access";
import {
  branchScopeWhere,
  getAccessibleBranchIds,
  getBranchWriteScope,
  getCurrentBranchScope,
  resolveWritableBranchId,
} from "@/lib/access/branch-access";
import { defaultShipmentStatus } from "@/lib/shipments/constants";
import { createWorkflowSteps } from "@/lib/shipments/workflow";
import {
  initShipmentWorkflowInternal,
  recalculateShipmentWorkflowInternal,
} from "@/lib/actions/shipment-workflow";
import {
  containerSchema,
  shipmentJobSchema,
  shipmentStatusSchema,
} from "@/lib/validators/shipments";
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

function typeCode(shipmentType: string) {
  return shipmentType === "EXPORT" ? "EXP" : "IMP";
}

async function generateJobNo(
  tx: Prisma.TransactionClient,
  companyId: string,
  shipmentType: string,
  transportMode: string,
) {
  const year = new Date().getFullYear();
  const prefix = `${transportMode}-${typeCode(shipmentType)}-${year}`;
  const existingJobs = await tx.shipmentjob.findMany({
    where: {
      companyId,
      jobNo: { contains: `-${year}-` },
    },
    select: { jobNo: true },
  });
  const existingMax = existingJobs.reduce((max, shipment) => {
    const sequence = Number(shipment.jobNo.split("-").at(-1));
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);
  const now = new Date();
  const sequence = await tx.shipmentjobsequence.upsert({
    where: { companyId_year: { companyId, year } },
    create: {
      id: randomUUID(),
      companyId,
      year,
      currentSequence: existingMax + 1,
      updatedAt: now,
    },
    update: {
      currentSequence: { increment: 1 },
      updatedAt: now,
    },
    select: { currentSequence: true },
  });

  let currentSeq = sequence.currentSequence;
  if (currentSeq <= existingMax) {
    const nextSeq = existingMax + 1;
    await tx.shipmentjobsequence.update({
      where: { companyId_year: { companyId, year } },
      data: { currentSequence: nextSeq, updatedAt: now },
    });
    currentSeq = nextSeq;
  }

  return `${prefix}-${String(currentSeq).padStart(4, "0")}`;
}

async function getShipmentForAction(
  shipmentJobId: string,
  companyId: string | null,
  accessibleBranchIds?: string[] | null,
) {
  const scope = companyId && accessibleBranchIds === undefined ? await getCurrentBranchScope(companyId) : accessibleBranchIds ?? null;
  const shipment = await prisma.shipmentjob.findFirst({
    where: {
      id: shipmentJobId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...branchScopeWhere(scope),
    },
  });

  return shipment;
}

export async function saveShipment(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const { user, companyId: scopedCompanyId } = await getScopedCompanyId(
    id ? "shipments:update" : "shipments:create",
  );
  const targetCompanyId = scopedCompanyId ?? getString(formData, "companyId");

  if (!targetCompanyId) return validationError("Company is required.");

  const moduleError = await ensureModuleAccess(targetCompanyId, "SHIPMENTS");
  if (moduleError) return validationError(moduleError);

  const { accessibleBranchIds, defaultBranchId } = await getBranchWriteScope({
    userId: user.id,
    companyId: targetCompanyId,
    permissions: user.permissions ?? [],
  });

  const parsed = shipmentJobSchema.safeParse({
    id,
    customerId: getString(formData, "customerId"),
    shipmentType: getString(formData, "shipmentType"),
    transportMode: getString(formData, "transportMode"),
    loadType: getString(formData, "loadType"),
    serviceScope: getString(formData, "serviceScope"),
    tradeTerm: getString(formData, "tradeTerm") || null,
    originCountry: getString(formData, "originCountry"),
    originPort: getString(formData, "originPort"),
    destinationCountry: getString(formData, "destinationCountry"),
    destinationPort: getString(formData, "destinationPort"),
    placeOfReceipt: getString(formData, "placeOfReceipt"),
    placeOfDelivery: getString(formData, "placeOfDelivery"),
    pickupAddress: getString(formData, "pickupAddress"),
    deliveryAddress: getString(formData, "deliveryAddress"),
    shipperName: getString(formData, "shipperName"),
    consigneeName: getString(formData, "consigneeName"),
    notifyParty: getString(formData, "notifyParty"),
    carrierName: getString(formData, "carrierName"),
    shippingLineOrAirline: getString(formData, "shippingLineOrAirline"),
    vesselName: getString(formData, "vesselName"),
    voyageNo: getString(formData, "voyageNo"),
    flightNo: getString(formData, "flightNo"),
    mblNo: getString(formData, "mblNo"),
    hblNo: getString(formData, "hblNo"),
    mawbNo: getString(formData, "mawbNo"),
    hawbNo: getString(formData, "hawbNo"),
    bookingNo: getString(formData, "bookingNo"),
    blOrAwbDate: getString(formData, "blOrAwbDate"),
    etd: getString(formData, "etd"),
    eta: getString(formData, "eta"),
    actualDeparture: getString(formData, "actualDeparture"),
    actualArrival: getString(formData, "actualArrival"),
    currentStatus: getString(formData, "currentStatus"),
    cargoDescription: getString(formData, "cargoDescription"),
    hsCode: getString(formData, "hsCode"),
    packageCount: getString(formData, "packageCount"),
    packageType: getString(formData, "packageType"),
    grossWeight: getString(formData, "grossWeight"),
    netWeight: getString(formData, "netWeight"),
    chargeableWeight: getString(formData, "chargeableWeight"),
    cbm: getString(formData, "cbm"),
    assignedToId: getString(formData, "assignedToId"),
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted shipment fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const [customer, assignedUser] = await Promise.all([
    prisma.customer.findFirst({
      where: {
        id: parsed.data.customerId,
        companyId: targetCompanyId,
        deletedAt: null,
      },
      select: { id: true },
    }),
    prisma.user.findFirst({
      where: {
        id: parsed.data.assignedToId,
        companyId: targetCompanyId,
        deletedAt: null,
      },
      select: { id: true },
    }),
  ]);

  if (!customer) {
    return validationError("Select a valid customer from this company.", {
      customerId: ["Select a valid customer from this company."],
    });
  }

  if (!assignedUser) {
    return validationError("Assigned employee must belong to this company.", {
      assignedToId: ["Assigned employee must belong to this company."],
    });
  }

  if (id) {
    const existing = await getShipmentForAction(id, scopedCompanyId, accessibleBranchIds);
    if (!existing) return validationError("Shipment was not found.");
    const existingModuleError = await ensureModuleAccess(existing.companyId, "SHIPMENTS");
    if (existingModuleError) return validationError(existingModuleError);
    const shipmentData = { ...parsed.data };
    delete shipmentData.id;

    const scopeChanged = existing.serviceScope !== shipmentData.serviceScope;
    if (scopeChanged) {
      const completedSteps = await prisma.shipmentworkflowstep.count({
        where: {
          companyId: existing.companyId,
          shipmentJobId: existing.id,
          deletedAt: null,
          status: "COMPLETED",
        },
      });
      if (completedSteps > 0) {
        return validationError(
          "Workflow already started; manual update required. Completed workflow steps were preserved.",
          { serviceScope: ["Cannot change service scope after workflow steps are completed."] },
        );
      }
    }

    const shipment = await prisma.$transaction(async (tx) => {
      const updated = await tx.shipmentjob.update({
        where: { id },
        data: { ...shipmentData, updatedAt: new Date() },
      });

      const templateParamsChanged =
        existing.transportMode !== updated.transportMode ||
        existing.shipmentType !== updated.shipmentType ||
        existing.loadType !== updated.loadType ||
        existing.serviceScope !== updated.serviceScope;

      if (templateParamsChanged) {
        await tx.shipmentworkflow.deleteMany({
          where: { shipmentJobId: existing.id },
        });
        await initShipmentWorkflowInternal(tx, existing.id, existing.companyId);
      }

      if (scopeChanged) {
        await tx.shipmentworkflowstep.deleteMany({
          where: {
            companyId: existing.companyId,
            shipmentJobId: existing.id,
          },
        });
        await createWorkflowSteps({
          tx,
          companyId: existing.companyId,
          shipmentJobId: existing.id,
          serviceScope: updated.serviceScope,
          actorId: user.id,
        });
      }

      await recalculateShipmentWorkflowInternal(tx, existing.id);
      return updated;
    });

    await audit({
      companyId: shipment.companyId,
      actorId: user.id,
      action: "SHIPMENT_UPDATED",
      entityType: "ShipmentJob",
      entityId: shipment.id,
      metadata: { jobNo: shipment.jobNo, shipmentJobId: shipment.id },
    });
    if (scopeChanged) {
      await audit({
        companyId: shipment.companyId,
        actorId: user.id,
        action: "SHIPMENT_WORKFLOW_REGENERATED",
        entityType: "ShipmentJob",
        entityId: shipment.id,
        metadata: {
          jobNo: shipment.jobNo,
          shipmentJobId: shipment.id,
          fromServiceScope: existing.serviceScope,
          toServiceScope: shipment.serviceScope,
        },
      });
    }

    revalidateAdminPaths();
    return successState("Shipment updated.");
  }

  const requestedBranchId = getString(formData, "branchId") || null;
  const branchId = await resolveWritableBranchId({
    companyId: targetCompanyId,
    accessibleBranchIds,
    defaultBranchId,
    requestedBranchId,
  });
  if (!branchId) {
    return validationError(requestedBranchId ? "Select a branch you have access to." : "Assign an active default branch before creating a shipment.", {
      branchId: ["Select a valid branch."],
    });
  }

  try {
    const shipmentData = { ...parsed.data };
    delete shipmentData.id;

    const shipment = await prisma.$transaction(async (tx) => {
      const jobNo = await generateJobNo(
        tx,
        targetCompanyId,
        shipmentData.shipmentType,
        shipmentData.transportMode,
      );
      const currentStatus =
        shipmentData.currentStatus ?? defaultShipmentStatus(shipmentData.shipmentType);

      const created = await tx.shipmentjob.create({
        data: {
          ...shipmentData,
          id: randomUUID(),
          companyId: targetCompanyId,
          branchId,
          jobNo,
          currentStatus,
          createdById: user.id,
          updatedAt: new Date(),
          shipmentstatusevent: {
            create: {
              id: randomUUID(),
              companyId: targetCompanyId,
              status: currentStatus,
              remarks: "Initial shipment status",
              updatedById: user.id,
            },
          },
        },
      });
      await createWorkflowSteps({
        tx,
        companyId: targetCompanyId,
        shipmentJobId: created.id,
        serviceScope: created.serviceScope,
        actorId: user.id,
      });
      await initShipmentWorkflowInternal(tx, created.id, targetCompanyId);
      await recalculateShipmentWorkflowInternal(tx, created.id);
      return created;
    });

    await audit({
      companyId: shipment.companyId,
      actorId: user.id,
      action: "SHIPMENT_CREATED",
      entityType: "ShipmentJob",
      entityId: shipment.id,
      metadata: { jobNo: shipment.jobNo, shipmentJobId: shipment.id },
    });
    await audit({
      companyId: shipment.companyId,
      actorId: user.id,
      action: "SHIPMENT_WORKFLOW_GENERATED",
      entityType: "ShipmentJob",
      entityId: shipment.id,
      metadata: {
        jobNo: shipment.jobNo,
        shipmentJobId: shipment.id,
        serviceScope: shipment.serviceScope,
      },
    });

    revalidateAdminPaths();
    return successState(`Shipment ${shipment.jobNo} created.`);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      try {
        const shipmentData = { ...parsed.data };
        delete shipmentData.id;
        const shipment = await prisma.$transaction(async (tx) => {
          const jobNo = await generateJobNo(
            tx,
            targetCompanyId,
            shipmentData.shipmentType,
            shipmentData.transportMode,
          );
          const currentStatus =
            shipmentData.currentStatus ?? defaultShipmentStatus(shipmentData.shipmentType);

          const created = await tx.shipmentjob.create({
            data: {
              ...shipmentData,
              id: randomUUID(),
              companyId: targetCompanyId,
              branchId,
              jobNo,
              currentStatus,
              createdById: user.id,
              updatedAt: new Date(),
              shipmentstatusevent: {
                create: {
                  id: randomUUID(),
                  companyId: targetCompanyId,
                  status: currentStatus,
                  remarks: "Initial shipment status",
                  updatedById: user.id,
                },
              },
            },
          });
          await createWorkflowSteps({
            tx,
            companyId: targetCompanyId,
            shipmentJobId: created.id,
            serviceScope: created.serviceScope,
            actorId: user.id,
          });
          await initShipmentWorkflowInternal(tx, created.id, targetCompanyId);
          await recalculateShipmentWorkflowInternal(tx, created.id);
          return created;
        });

        await audit({
          companyId: shipment.companyId,
          actorId: user.id,
          action: "SHIPMENT_CREATED",
          entityType: "ShipmentJob",
          entityId: shipment.id,
          metadata: { jobNo: shipment.jobNo, shipmentJobId: shipment.id },
        });
        await audit({
          companyId: shipment.companyId,
          actorId: user.id,
          action: "SHIPMENT_WORKFLOW_GENERATED",
          entityType: "ShipmentJob",
          entityId: shipment.id,
          metadata: {
            jobNo: shipment.jobNo,
            shipmentJobId: shipment.id,
            serviceScope: shipment.serviceScope,
          },
        });

        revalidateAdminPaths();
        return successState(`Shipment ${shipment.jobNo} created.`);
      } catch (retryError) {
        if (
          retryError instanceof Prisma.PrismaClientKnownRequestError &&
          retryError.code === "P2002"
        ) {
          return validationError(
            "Could not reserve a unique job number. Please try again.",
          );
        }

        throw retryError;
      }
    }

    throw error;
  }
}

export async function deleteShipment(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("shipments:delete");
  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId,
    permissions: user.permissions ?? [],
  });
  const id = getString(formData, "id");
  const shipment = await getShipmentForAction(id, companyId, accessibleBranchIds);

  if (!shipment) return;
  if (await ensureModuleAccess(shipment.companyId, "SHIPMENTS")) return;

  const deleted = await prisma.shipmentjob.update({
    where: { id },
    data: { deletedAt: new Date(), updatedAt: new Date() },
  });

  await audit({
    companyId: deleted.companyId,
    actorId: user.id,
    action: "SHIPMENT_DELETED",
    entityType: "ShipmentJob",
    entityId: deleted.id,
    metadata: { jobNo: deleted.jobNo, shipmentJobId: deleted.id },
  });

  revalidateAdminPaths();
}

export async function saveContainer(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId(
    "shipments:containers:manage",
  );
  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId,
    permissions: user.permissions ?? [],
  });
  const parsed = containerSchema.safeParse({
    id: getString(formData, "id") || undefined,
    shipmentJobId: getString(formData, "shipmentJobId"),
    containerNo: getString(formData, "containerNo"),
    sealNo: getString(formData, "sealNo"),
    containerType: getString(formData, "containerType"),
    packageCount: getString(formData, "packageCount"),
    grossWeight: getString(formData, "grossWeight"),
    cbm: getString(formData, "cbm"),
    gateInDate: getString(formData, "gateInDate"),
    gateOutDate: getString(formData, "gateOutDate"),
    freeTimeLastDate: getString(formData, "freeTimeLastDate"),
    demurrageRiskStatus: getString(formData, "demurrageRiskStatus") || "NOT_APPLICABLE",
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted container fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const shipment = await getShipmentForAction(parsed.data.shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment) return validationError("Shipment was not found.");
  const moduleError = await ensureModuleAccess(shipment.companyId, "SHIPMENTS");
  if (moduleError) return validationError(moduleError);

  if (parsed.data.id) {
    const existing = await prisma.container.findFirst({
      where: {
        id: parsed.data.id,
        shipmentJobId: shipment.id,
        companyId: shipment.companyId,
        deletedAt: null,
      },
    });
    if (!existing) return validationError("Container was not found.");

    const containerData = { ...parsed.data };
    delete containerData.id;
    const container = await prisma.container.update({
      where: { id: parsed.data.id },
      data: { ...containerData, updatedAt: new Date() },
    });

    await audit({
      companyId: shipment.companyId,
      actorId: user.id,
      action: "CONTAINER_UPDATED",
      entityType: "Container",
      entityId: container.id,
      metadata: {
        containerNo: container.containerNo,
        jobNo: shipment.jobNo,
        shipmentJobId: shipment.id,
      },
    });

    revalidateAdminPaths();
    return successState("Container updated.");
  }

  const containerData = { ...parsed.data };
  delete containerData.id;
  const container = await prisma.container.create({
    data: {
      ...containerData,
      id: randomUUID(),
      companyId: shipment.companyId,
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId: shipment.companyId,
    actorId: user.id,
    action: "CONTAINER_CREATED",
    entityType: "Container",
    entityId: container.id,
    metadata: {
      containerNo: container.containerNo,
      jobNo: shipment.jobNo,
      shipmentJobId: shipment.id,
    },
  });

  revalidateAdminPaths();
  return successState("Container added.");
}

export async function deleteContainer(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId(
    "shipments:containers:manage",
  );
  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId,
    permissions: user.permissions ?? [],
  });
  const id = getString(formData, "id");

  const container = await prisma.container.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...(accessibleBranchIds !== null
        ? { shipmentjob: { branchId: { in: accessibleBranchIds } } }
        : {}),
    },
    include: { shipmentjob: { select: { id: true, jobNo: true } } },
  });

  if (!container) return;
  if (await ensureModuleAccess(container.companyId, "SHIPMENTS")) return;

  const deleted = await prisma.container.update({
    where: { id },
    data: { deletedAt: new Date(), updatedAt: new Date() },
  });

  await audit({
    companyId: deleted.companyId,
    actorId: user.id,
    action: "CONTAINER_DELETED",
    entityType: "Container",
    entityId: deleted.id,
    metadata: {
      containerNo: deleted.containerNo,
      jobNo: container.shipmentjob.jobNo,
      shipmentJobId: container.shipmentjob.id,
    },
  });

  revalidateAdminPaths();
}

export async function addShipmentStatus(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId(
    "shipments:status:update",
  );
  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId,
    permissions: user.permissions ?? [],
  });
  const parsed = shipmentStatusSchema.safeParse({
    shipmentJobId: getString(formData, "shipmentJobId"),
    shipmentType: getString(formData, "shipmentType"),
    status: getString(formData, "status"),
    remarks: getString(formData, "remarks"),
  });

  if (!parsed.success) {
    return validationError(
      "Please select a valid shipment status.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const shipment = await getShipmentForAction(parsed.data.shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment) return validationError("Shipment was not found.");
  const moduleError = await ensureModuleAccess(shipment.companyId, "SHIPMENTS");
  if (moduleError) return validationError(moduleError);

  await prisma.$transaction(async (tx) => {
    await tx.shipmentstatusevent.create({
      data: {
        id: randomUUID(),
        companyId: shipment.companyId,
        shipmentJobId: shipment.id,
        status: parsed.data.status,
        remarks: parsed.data.remarks,
        updatedById: user.id,
      },
    });
    await tx.shipmentjob.update({
      where: { id: shipment.id },
      data: {
        currentStatus: parsed.data.status,
        closedAt: parsed.data.status === "Closed" ? new Date() : shipment.closedAt,
        updatedAt: new Date(),
      },
    });
    await recalculateShipmentWorkflowInternal(tx, shipment.id);
  });

  await audit({
    companyId: shipment.companyId,
    actorId: user.id,
    action: "SHIPMENT_STATUS_CHANGED",
    entityType: "ShipmentJob",
    entityId: shipment.id,
    metadata: {
      jobNo: shipment.jobNo,
      shipmentJobId: shipment.id,
      from: shipment.currentStatus,
      to: parsed.data.status,
    },
  });

  revalidateAdminPaths();
  return successState("Shipment status updated.");
}

export async function saveShipmentParties(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const shipmentId = getString(formData, "shipmentId");
  if (!shipmentId) return validationError("Shipment ID is required.");

  const { user, companyId } = await getScopedCompanyId("shipments:update");
  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId,
    permissions: user.permissions ?? [],
  });

  const shipment = await prisma.shipmentjob.findFirst({
    where: {
      id: shipmentId,
      companyId: companyId ?? undefined,
      deletedAt: null,
      ...branchScopeWhere(accessibleBranchIds),
    },
  });

  if (!shipment) return validationError("Shipment not found.");

  await prisma.shipmentjob.update({
    where: { id: shipmentId },
    data: {
      shipperName: getString(formData, "shipperName") || null,
      shipperAddress: getString(formData, "shipperAddress") || null,
      consigneeName: getString(formData, "consigneeName") || null,
      consigneeAddress: getString(formData, "consigneeAddress") || null,
      consigneeBin: getString(formData, "consigneeBin") || null,
      notifyPartyName: getString(formData, "notifyPartyName") || null,
      notifyPartyAddress: getString(formData, "notifyPartyAddress") || null,
      notifyPartyBin: getString(formData, "notifyPartyBin") || null,
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_PARTIES_UPDATED",
    entityType: "ShipmentJob",
    entityId: shipmentId,
    metadata: {
      jobNo: shipment.jobNo,
    },
  });

  revalidateAdminPaths();
  return successState("Parties details updated successfully.");
}

export async function saveShipmentMarksAndNumbers(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const shipmentId = getString(formData, "shipmentId");
  const marksAndNumbers = getString(formData, "marksAndNumbers");

  if (!shipmentId) return validationError("Shipment ID is required.");

  const { user, companyId } = await getScopedCompanyId("shipments:update");
  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId,
    permissions: user.permissions ?? [],
  });

  const shipment = await prisma.shipmentjob.findFirst({
    where: {
      id: shipmentId,
      companyId: companyId ?? undefined,
      deletedAt: null,
      ...branchScopeWhere(accessibleBranchIds),
    },
  });

  if (!shipment) return validationError("Shipment not found.");

  await prisma.shipmentjob.update({
    where: { id: shipmentId },
    data: {
      marksAndNumbers: marksAndNumbers || null,
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_MARKS_EXTRACTED",
    entityType: "ShipmentJob",
    entityId: shipmentId,
    metadata: {
      jobNo: shipment.jobNo,
      marksAndNumbers,
    },
  });

  revalidateAdminPaths();
  return successState("Marks & Numbers extracted and saved successfully.");
}
