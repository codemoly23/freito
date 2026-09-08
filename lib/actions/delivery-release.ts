"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import {
  audit,
  getScopedCompanyId,
  getString,
} from "@/lib/actions/helpers";
import { getNextDocumentNumber } from "@/lib/actions/freight-documents";
import { recalculateShipmentWorkflowInternal } from "@/lib/actions/shipment-workflow";
import type { freightdocument_status, freightdocument_type, Prisma } from "@/lib/generated/prisma/client";
import { getRequiredDocumentsDb } from "@/lib/documents/engine";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { sanitizeFileName, validateDocumentFile } from "@/lib/documents/storage";
import { blobPut } from "@/lib/blob/client";
import { branchScopeWhere, getCurrentBranchScope } from "@/lib/access/branch-access";
import { dispatchNotificationEvent, resolveActivePortalAccountId, resolvePortalLinkUrl } from "@/lib/notifications/dispatch-event";
import type { NotificationEventKey } from "@/lib/notifications/event-definitions";

// New (unproven) notification dispatch path -- never let it block an
// existing delivery-release write. Every call site below is fire-and-forget-safe.
async function notifySafely(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    console.error("Delivery-release notification dispatch failed.", error instanceof Error ? error.message : error);
  }
}

type DeliveryNotifyShipment = { id: string; jobNo: string; branchId: string; assignedToId: string | null; customerId: string };

async function notifyDeliveryEvent(
  eventKey: NotificationEventKey,
  companyId: string,
  shipment: DeliveryNotifyShipment,
  extraVariables: Record<string, string | number | null | undefined> = {},
) {
  await notifySafely(async () => {
    const isPortalEvent = ["delivery_scheduled", "out_for_delivery", "delivered", "pod_uploaded", "pod_verified"].includes(eventKey);
    const portalRecipientAccountId = isPortalEvent
      ? await resolveActivePortalAccountId({ customerId: shipment.customerId, companyId })
      : null;
    const portalLinkUrl = portalRecipientAccountId
      ? await resolvePortalLinkUrl({ companyId, path: `/shipments/${shipment.id}` })
      : null;
    await dispatchNotificationEvent({
      eventKey,
      companyId,
      branchId: shipment.branchId,
      entityId: shipment.id,
      internalRecipientUserId: shipment.assignedToId,
      portalRecipientAccountId,
      variables: { jobNo: shipment.jobNo, shipmentNumber: shipment.jobNo, ...extraVariables },
      internalLinkUrl: `/dashboard/shipments/${shipment.id}`,
      portalLinkUrl,
    });
  });
}

type ShipmentReleaseState = {
  serviceScope: string;
  freightdocument: { type: freightdocument_type; status: freightdocument_status }[];
  cargoreleasechecklist: {
    cargoReleased: boolean;
    delivered: boolean;
  } | null;
};

async function getDeliveryShipment(shipmentJobId: string, companyId: string) {
  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  return prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
  });
}

function hasReleaseDocument(
  shipment: ShipmentReleaseState,
  type: freightdocument_type
) {
  return shipment.freightdocument.some(
    (doc) =>
      doc.type === type &&
      (doc.status === "RECEIVED" || doc.status === "VERIFIED")
  );
}

function isDeliveryRequired(serviceScope: string) {
  return serviceScope === "PORT_TO_DOOR" || serviceScope === "DOOR_TO_DOOR";
}

function releaseDocsReady(shipment: ShipmentReleaseState) {
  return (
    hasReleaseDocument(shipment, "DELIVERY_ORDER") &&
    hasReleaseDocument(shipment, "CUSTOMS_RELEASE")
  );
}

async function canCloseShipment(shipmentId: string, companyId: string) {
  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: {
      freightdocument: { where: { deletedAt: null } },
      cargoreleasechecklist: true,
      shipmentdocument: { where: { deletedAt: null } }
    }
  });
  if (!shipment) return false;

  if (!releaseDocsReady(shipment)) return false;

  if (isDeliveryRequired(shipment.serviceScope)) {
    const checklist = shipment.cargoreleasechecklist;
    const podOk = shipment.freightdocument.some(
      (doc) => doc.type === "POD" && doc.status === "VERIFIED"
    );
    if (!checklist?.cargoReleased || !checklist.delivered || !podOk) return false;
  }

  // Compliance Engine check:
  // Get all mandatory checklist items from Document Master config
  const reqChecklist = await getRequiredDocumentsDb(shipmentId);
  for (const item of reqChecklist) {
    const doc = shipment.shipmentdocument.find(
      (candidate) => candidate.documentName.toLowerCase() === item.name.toLowerCase() && candidate.deletedAt === null
    );
    if (!doc || doc.status === "PENDING" || doc.status === "REJECTED") {
      return false;
    }
  }

  return true;
}

async function canReleaseDelivery(shipmentJobId: string): Promise<boolean> {
  const masterChecklist = await getRequiredDocumentsDb(shipmentJobId);
  const deliveryMandatory = masterChecklist.filter(item => item.mandatoryBeforeDeliveryOrder);
  if (deliveryMandatory.length === 0) return true;

  const uploadedDocs = await prisma.shipmentdocument.findMany({
    where: { shipmentJobId, deletedAt: null },
  });
  for (const item of deliveryMandatory) {
    const hasDoc = uploadedDocs.some(
      doc => doc.documentName.toLowerCase() === item.name.toLowerCase() && doc.status !== "PENDING" && doc.status !== "REJECTED"
    );
    if (!hasDoc) return false;
  }
  return true;
}

// Helper to get or create a FreightDocument for a given shipment
async function getOrCreateFreightDocument(
  tx: Omit<Prisma.TransactionClient, never>,
  companyId: string,
  shipmentJobId: string,
  type: freightdocument_type,
  status: freightdocument_status
) {
  let doc = await tx.freightdocument.findFirst({
    where: { shipmentJobId, type, deletedAt: null },
  });

  if (!doc) {
    const shipment = await tx.shipmentjob.findFirst({
      where: { id: shipmentJobId, companyId, deletedAt: null },
      select: { branchId: true },
    });
    if (!shipment) throw new Error("Shipment was not found for document creation.");
    const documentNo = await getNextDocumentNumber(tx, companyId, type);
    doc = await tx.freightdocument.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId: shipment.branchId,
        shipmentJobId,
        type,
        documentNo,
        status,
        responsibility: "CARRIER_ISSUED",
        visibility: "CLIENT_SAFE",
        handlingMode: "RECORD_AND_UPLOAD",
        isClientVisible: true,
        updatedAt: new Date(),
      },
    });
  } else {
    doc = await tx.freightdocument.update({
      where: { id: doc.id },
      data: { status, updatedAt: new Date() },
    });
  }
  return doc;
}

// 1. Mark Delivery Order Received / Verified
export async function markDeliveryOrderAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");
  const status = getString(formData, "status") as freightdocument_status; // RECEIVED or VERIFIED

  if (!shipmentJobId || (status !== "RECEIVED" && status !== "VERIFIED")) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  if (!(await canReleaseDelivery(shipmentJobId))) return;

  const shipment = await getDeliveryShipment(shipmentJobId, companyId);
  if (!shipment) return;

  const doc = await prisma.$transaction(async (tx) => {
    const d = await getOrCreateFreightDocument(
      tx,
      companyId,
      shipmentJobId,
      "DELIVERY_ORDER",
      status
    );

    await tx.cargoreleasechecklist.upsert({
      where: { shipmentJobId },
      create: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        deliveryOrderReleased: true,
        status: status === "VERIFIED" ? "READY_FOR_RELEASE" : "DOCUMENTS_PENDING",
        updatedAt: new Date(),
      },
      update: {
        deliveryOrderReleased: true,
        updatedAt: new Date(),
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
    return d;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: status === "RECEIVED" ? "DELIVERY_ORDER_RECEIVED" : "DELIVERY_ORDER_VERIFIED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: { shipmentJobId, docId: doc.id },
  });
  if (status === "VERIFIED") {
    await notifyDeliveryEvent("delivery_order_verified", companyId, shipment);
  }

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 2. Mark Customs Release Received / Verified
export async function markCustomsReleaseAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");
  const status = getString(formData, "status") as freightdocument_status; // RECEIVED or VERIFIED

  if (!shipmentJobId || (status !== "RECEIVED" && status !== "VERIFIED")) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const shipment = await getDeliveryShipment(shipmentJobId, companyId);
  if (!shipment) return;

  const doc = await prisma.$transaction(async (tx) => {
    const d = await getOrCreateFreightDocument(
      tx,
      companyId,
      shipmentJobId,
      "CUSTOMS_RELEASE",
      status
    );

    await tx.cargoreleasechecklist.upsert({
      where: { shipmentJobId },
      create: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        customsReady: true,
        updatedAt: new Date(),
      },
      update: {
        customsReady: true,
        updatedAt: new Date(),
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
    return d;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: status === "RECEIVED" ? "CUSTOMS_RELEASE_RECEIVED" : "CUSTOMS_RELEASE_VERIFIED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: { shipmentJobId, docId: doc.id },
  });
  if (status === "VERIFIED") {
    await notifyDeliveryEvent("customs_release_verified", companyId, shipment);
  }

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 3. Mark Gate Pass Received / Verified
export async function markGatePassAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");
  const status = getString(formData, "status") as freightdocument_status; // RECEIVED or VERIFIED

  if (!shipmentJobId || (status !== "RECEIVED" && status !== "VERIFIED")) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const shipment = await getDeliveryShipment(shipmentJobId, companyId);
  if (!shipment) return;

  const doc = await prisma.$transaction(async (tx) => {
    const d = await getOrCreateFreightDocument(
      tx,
      companyId,
      shipmentJobId,
      "GATE_PASS",
      status
    );

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
    return d;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: status === "RECEIVED" ? "GATE_PASS_RECEIVED" : "GATE_PASS_VERIFIED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: { shipmentJobId, docId: doc.id },
  });
  if (status === "VERIFIED") {
    await notifyDeliveryEvent("gate_pass_verified", companyId, shipment);
  }

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 4. Mark Cargo Released
export async function markCargoReleasedAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");

  if (!shipmentJobId) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  if (!(await canReleaseDelivery(shipmentJobId))) return;

  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: {
      freightdocument: {
        where: { deletedAt: null }
      },
      cargoreleasechecklist: true,
    }
  });
  if (!shipment) return;

  if (!releaseDocsReady(shipment)) return;

  const checklist = await prisma.$transaction(async (tx) => {
    const c = await tx.cargoreleasechecklist.upsert({
      where: { shipmentJobId },
      create: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        cargoReleased: true,
        cargoReleasedAt: new Date(),
        releaseDate: new Date(),
        status: "RELEASED",
        updatedAt: new Date(),
      },
      update: {
        cargoReleased: true,
        cargoReleasedAt: new Date(),
        releaseDate: new Date(),
        status: "RELEASED",
        updatedAt: new Date(),
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
    return c;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "CARGO_RELEASED",
    entityType: "CargoReleaseChecklist",
    entityId: checklist.id,
    metadata: { shipmentJobId },
  });
  await notifyDeliveryEvent("cargo_released", companyId, shipment);

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 5. Schedule Delivery
export async function scheduleDeliveryAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");
  const deliveryLocation = getString(formData, "deliveryLocation");
  const deliveryAddress = getString(formData, "deliveryAddress");
  const consigneeContact = getString(formData, "consigneeContact");
  const deliveryDateTimeStr = getString(formData, "deliveryDateTime");
  const truckVehicleNo = getString(formData, "truckVehicleNo");
  const driverName = getString(formData, "driverName");
  const driverPhone = getString(formData, "driverPhone");
  const transportVendorId = getString(formData, "transportVendorId");
  const warehouseName = getString(formData, "warehouseName");
  const deliveryRemarks = getString(formData, "deliveryRemarks");

  if (!shipmentJobId) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const shipment = await getDeliveryShipment(shipmentJobId, companyId);
  if (!shipment) return;

  const deliveryDateTime = deliveryDateTimeStr ? new Date(deliveryDateTimeStr) : null;

  const checklist = await prisma.$transaction(async (tx) => {
    const c = await tx.cargoreleasechecklist.upsert({
      where: { shipmentJobId },
      create: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        deliveryLocation,
        deliveryAddress,
        consigneeContact,
        deliveryDateTime,
        truckVehicleNo,
        driverName,
        driverPhone,
        transportVendorId,
        warehouseName,
        deliveryRemarks,
        updatedAt: new Date(),
      },
      update: {
        deliveryLocation,
        deliveryAddress,
        consigneeContact,
        deliveryDateTime,
        truckVehicleNo,
        driverName,
        driverPhone,
        transportVendorId,
        warehouseName,
        deliveryRemarks,
        updatedAt: new Date(),
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
    return c;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "DELIVERY_SCHEDULED",
    entityType: "CargoReleaseChecklist",
    entityId: checklist.id,
    metadata: { shipmentJobId },
  });
  await notifyDeliveryEvent("delivery_scheduled", companyId, shipment, {
    scheduledDate: deliveryDateTime ? deliveryDateTime.toISOString().slice(0, 10) : "",
  });

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 6. Mark Out for Delivery
export async function markOutForDeliveryAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");

  if (!shipmentJobId) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: { cargoreleasechecklist: true },
  });
  if (!shipment) return;
  if (!shipment.cargoreleasechecklist?.cargoReleased) return;

  const now = new Date();

  const checklist = await prisma.$transaction(async (tx) => {
    const c = await tx.cargoreleasechecklist.upsert({
      where: { shipmentJobId },
      create: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        cargoReleased: true,
        cargoReleasedAt: now,
        outForDeliveryAt: now,
        status: "RELEASED",
        updatedAt: now,
      },
      update: {
        outForDeliveryAt: now,
        updatedAt: now,
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
    return c;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "OUT_FOR_DELIVERY",
    entityType: "CargoReleaseChecklist",
    entityId: checklist.id,
    metadata: { shipmentJobId },
  });
  await notifyDeliveryEvent("out_for_delivery", companyId, shipment);

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 7. Mark Delivered
export async function markDeliveredAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");

  if (!shipmentJobId) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const shipment = await getDeliveryShipment(shipmentJobId, companyId);
  if (!shipment) return;

  const now = new Date();

  const checklist = await prisma.$transaction(async (tx) => {
    const c = await tx.cargoreleasechecklist.upsert({
      where: { shipmentJobId },
      create: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        delivered: true,
        deliveredAt: now,
        status: "DELIVERED",
        updatedAt: now,
      },
      update: {
        delivered: true,
        deliveredAt: now,
        status: "DELIVERED",
        updatedAt: now,
      },
    });

    await tx.shipmentjob.update({
      where: { id: shipmentJobId },
      data: {
        deliveredAt: now,
        currentStatus: "Delivered",
        updatedAt: now,
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
    return c;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_DELIVERED",
    entityType: "CargoReleaseChecklist",
    entityId: checklist.id,
    metadata: { shipmentJobId },
  });
  await notifyDeliveryEvent("delivered", companyId, shipment, { deliveredAt: now.toISOString().slice(0, 10) });

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 8. Upload POD Document
export async function uploadPodAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");
  const podReferenceNo = getString(formData, "podReferenceNo");
  const file = formData.get("file");

  if (!shipmentJobId) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const shipment = await getDeliveryShipment(shipmentJobId, companyId);
  if (!shipment) return;

  // Handle optional file upload
  let fileData: { fileName: string; originalFileName: string; filePath: string; mimeType: string; fileSize: number } | null = null;
  if (file instanceof File && file.size > 0) {
    const fileError = validateDocumentFile(file);
    if (fileError) return;

    const safeName = sanitizeFileName(file.name);
    const extension = path.extname(safeName).toLowerCase();
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    const blobName = `uploads/${companyId}/${shipmentJobId}/${storedName}`;
    await blobPut(blobName, await file.arrayBuffer(), file.type || "application/octet-stream");

    fileData = {
      fileName: storedName,
      originalFileName: safeName,
      filePath: blobName,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    };
  }

  const doc = await prisma.$transaction(async (tx) => {
    const documentNo = await getNextDocumentNumber(tx, companyId, "POD");
    const d = await tx.freightdocument.create({
      data: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        type: "POD",
        branchId: shipment.branchId,
        documentNo,
        status: fileData ? "RECEIVED" : "PENDING_RECEIPT",
        responsibility: "CUSTOMER_PROVIDED",
        visibility: "CLIENT_SAFE",
        handlingMode: "RECORD_AND_UPLOAD",
        isClientVisible: true,
        referenceNo: podReferenceNo,
        updatedAt: new Date(),
        ...(fileData ? {
          fileName: fileData.fileName,
          originalFileName: fileData.originalFileName,
          filePath: fileData.filePath,
          mimeType: fileData.mimeType,
          fileSize: fileData.fileSize,
          uploadedById: user.id,
        } : {}),
      },
    });

    await tx.cargoreleasechecklist.upsert({
      where: { shipmentJobId },
      create: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        podReferenceNo,
        updatedAt: new Date(),
      },
      update: {
        podReferenceNo,
        updatedAt: new Date(),
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
    return d;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "POD_UPLOADED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: { shipmentJobId, docId: doc.id },
  });
  await notifyDeliveryEvent("pod_uploaded", companyId, shipment, { podReferenceNo });

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 9. Verify POD
export async function verifyPodAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");

  if (!shipmentJobId) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const shipment = await getDeliveryShipment(shipmentJobId, companyId);
  if (!shipment) return;

  const podDoc = await prisma.freightdocument.findFirst({
    where: { shipmentJobId, type: "POD", deletedAt: null },
  });
  if (!podDoc) return;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.freightdocument.update({
      where: { id: podDoc.id },
      data: {
        status: "VERIFIED",
        verifiedById: user.id,
        verifiedAt: now,
        updatedAt: now,
      },
    });

    await tx.cargoreleasechecklist.upsert({
      where: { shipmentJobId },
      create: {
        id: randomUUID(),
        companyId,
        shipmentJobId,
        verifiedBy: user.email,
        verifiedAt: now,
        updatedAt: now,
      },
      update: {
        verifiedBy: user.email,
        verifiedAt: now,
        updatedAt: now,
      },
    });

    await tx.shipmentjob.update({
      where: { id: shipmentJobId },
      data: {
        proofOfDeliveryAt: now,
        updatedAt: now,
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "POD_VERIFIED",
    entityType: "FreightDocument",
    entityId: podDoc.id,
    metadata: { shipmentJobId, docId: podDoc.id },
  });
  await notifyDeliveryEvent("pod_verified", companyId, shipment);

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 10. Mark Job Close Ready
export async function markJobCloseReadyAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");

  if (!shipmentJobId) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: {
      freightdocument: {
        where: { deletedAt: null }
      },
      cargoreleasechecklist: true,
    }
  });
  if (!shipment) return;

  if (!(await canCloseShipment(shipmentJobId, companyId))) return;

  await prisma.shipmentjob.update({
    where: { id: shipmentJobId },
    data: {
      operationsStatus: "CLOSE_READY",
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "JOB_CLOSE_READY",
    entityType: "ShipmentJob",
    entityId: shipmentJobId,
    metadata: { shipmentJobId },
  });

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

// 11. Close Job
export async function closeJobAction(formData: FormData): Promise<void> {
  const shipmentJobId = getString(formData, "shipmentJobId");

  if (!shipmentJobId) return;

  const { user, companyId } = await getScopedCompanyId("bookings:manage");

  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: {
      freightdocument: {
        where: { deletedAt: null }
      },
      cargoreleasechecklist: true,
    }
  });
  if (!shipment) return;

  if (shipment.operationsStatus !== "CLOSE_READY") return;
  if (!(await canCloseShipment(shipmentJobId, companyId))) return;

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.shipmentjob.update({
      where: { id: shipmentJobId },
      data: {
        closedAt: now,
        currentStageCode: "JOB_CLOSED",
        currentStatus: "Closed",
        updatedAt: now,
      },
    });

    await recalculateShipmentWorkflowInternal(tx, shipmentJobId);
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "JOB_CLOSED",
    entityType: "ShipmentJob",
    entityId: shipmentJobId,
    metadata: { shipmentJobId },
  });

  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}
