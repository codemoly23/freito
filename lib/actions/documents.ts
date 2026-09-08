"use server";

import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { createCompanyNotification } from "@/lib/notifications/create-notification";
import { safelyCreateCustomerDeliveries } from "@/lib/notifications/templates";
import { ensureModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { recalculateShipmentWorkflowInternal } from "@/lib/actions/shipment-workflow";
import {
  sanitizeFileName,
  validateDocumentFile,
} from "@/lib/documents/storage";
import { blobPut } from "@/lib/blob/client";
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

async function getShipmentForDocument(shipmentJobId: string, companyId: string | null, accessibleBranchIds: string[] | null = null) {
  return prisma.shipmentjob.findFirst({
    where: {
      id: shipmentJobId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...branchScopeWhere(accessibleBranchIds),
    },
    select: { id: true, companyId: true, branchId: true, shipmentType: true, jobNo: true, closedAt: true },
  });
}

async function getChecklistItem(
  checklistItemId: string,
  shipmentType: string,
  companyId: string,
) {
  return prisma.documentchecklistitem.findFirst({
    where: {
      id: checklistItemId,
      isActive: true,
      OR: [
        { companyId: null },
        { companyId },
      ],
      AND: [
        {
          OR: [
            { category: "COMMON" },
            { category: shipmentType as "IMPORT" | "EXPORT" },
          ],
        },
      ],
    },
  });
}

async function getDocumentForAction(
  documentId: string,
  shipmentJobId: string,
  companyId: string | null,
) {
  return prisma.shipmentdocument.findFirst({
    where: {
      id: documentId,
      shipmentJobId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    },
  });
}

function fileMetadata(fileName: string, shipmentJobId: string) {
  const safeName = sanitizeFileName(fileName);
  const extension = path.extname(safeName).toLowerCase();
  return {
    originalFileName: safeName,
    fileName: `${Date.now()}-${randomUUID()}${extension}`,
    shipmentJobId,
  };
}

export async function uploadShipmentDocument(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:upload");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const shipmentJobId = getString(formData, "shipmentJobId");
  const checklistItemId = getString(formData, "checklistItemId");
  const remarks = getString(formData, "remarks") || null;
  const file = formData.get("file");

  const shipment = await getShipmentForDocument(shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment) return validationError("Shipment was not found.");
  if (shipment.closedAt) return validationError("This shipment job is closed and its operational files are locked.");
  const moduleError = await ensureModuleAccess(shipment.companyId, "DOCUMENTS");
  if (moduleError) return validationError(moduleError);
  if (!checklistItemId) return validationError("Checklist item is required.");

  const checklistItem = await getChecklistItem(
    checklistItemId,
    shipment.shipmentType,
    shipment.companyId,
  );
  if (!checklistItem) return validationError("Invalid checklist item.");
  if (!(file instanceof File)) return validationError("Select a file to upload.");

  const fileError = validateDocumentFile(file);
  if (fileError) return validationError(fileError);

  const names = fileMetadata(file.name, shipment.id);
  const blobName = `uploads/${shipment.companyId}/${shipment.id}/${names.fileName}`;
  await blobPut(blobName, await file.arrayBuffer(), file.type || "application/octet-stream");

  const existing = await prisma.shipmentdocument.findFirst({
    where: {
      companyId: shipment.companyId,
      branchId: shipment.branchId,
      shipmentJobId: shipment.id,
      checklistItemId,
      deletedAt: null,
    },
    orderBy: { version: "desc" },
  });

  const version = existing ? existing.version + 1 : 1;
  const document = await prisma.shipmentdocument.create({
    data: {
      id: randomUUID(),
      companyId: shipment.companyId,
      branchId: shipment.branchId,
      shipmentJobId: shipment.id,
      checklistItemId,
      documentName: checklistItem.name,
      documentType: checklistItem.category,
      status: "UPLOADED",
      fileName: names.fileName,
      originalFileName: names.originalFileName,
      filePath: blobName,
      mimeType: file.type || null,
      fileSize: file.size,
      version,
      remarks,
      uploadedById: user.id,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId: shipment.companyId,
    actorId: user.id,
    action: version > 1 ? "DOCUMENT_REPLACED" : "DOCUMENT_UPLOADED",
    entityType: "ShipmentDocument",
    entityId: document.id,
    metadata: {
      shipmentJobId: shipment.id,
      documentId: document.id,
      documentName: document.documentName,
      status: document.status,
      version: document.version,
      fileName: document.fileName,
      ...(version > 1 ? { replacedVersion: version - 1 } : {}),
    },
  });

  revalidateAdminPaths();
  return successState(`${document.documentName} uploaded.`);
}


export async function verifyShipmentDocument(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documents:verify");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const shipmentJobId = getString(formData, "shipmentJobId");
  const documentId = getString(formData, "documentId");
  
  const shipment = await getShipmentForDocument(shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment || shipment.closedAt) return;

  const document = await getDocumentForAction(documentId, shipmentJobId, companyId);
  if (!document) return;
  if (await ensureModuleAccess(document.companyId, "DOCUMENTS")) return;

  const updated = await prisma.$transaction(async (tx) => {
    const doc = await tx.shipmentdocument.update({
      where: { id: document.id },
      data: {
        status: "VERIFIED",
        verifiedById: user.id,
        rejectedById: null,
        verifiedAt: new Date(),
        rejectedAt: null,
        updatedAt: new Date(),
      },
    });
    await recalculateShipmentWorkflowInternal(tx, doc.shipmentJobId);
    return doc;
  });

  await audit({
    companyId: updated.companyId,
    actorId: user.id,
    action: "DOCUMENT_VERIFIED",
    entityType: "ShipmentDocument",
    entityId: updated.id,
    metadata: {
      shipmentJobId: updated.shipmentJobId,
      documentId: updated.id,
      documentName: updated.documentName,
      status: updated.status,
      version: updated.version,
      fileName: updated.fileName,
    },
  });

  revalidateAdminPaths();
}

export async function rejectShipmentDocument(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:verify");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const shipmentJobId = getString(formData, "shipmentJobId");
  const documentId = getString(formData, "documentId");
  const remarks = getString(formData, "remarks").trim();
  if (!remarks) return validationError("Rejection remarks are required.");

  const shipment = await getShipmentForDocument(shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment) return validationError("Shipment was not found.");
  if (shipment.closedAt) return validationError("This shipment job is closed and its operational files are locked.");

  const document = await getDocumentForAction(documentId, shipmentJobId, companyId);
  if (!document) return validationError("Document was not found.");
  const moduleError = await ensureModuleAccess(document.companyId, "DOCUMENTS");
  if (moduleError) return validationError(moduleError);

  const updated = await prisma.$transaction(async (tx) => {
    const doc = await tx.shipmentdocument.update({
      where: { id: document.id },
      data: {
        status: "REJECTED",
        remarks,
        rejectedById: user.id,
        verifiedById: null,
        rejectedAt: new Date(),
        verifiedAt: null,
        updatedAt: new Date(),
      },
    });
    await recalculateShipmentWorkflowInternal(tx, doc.shipmentJobId);
    return doc;
  });

  await audit({
    companyId: updated.companyId,
    actorId: user.id,
    action: "DOCUMENT_REJECTED",
    entityType: "ShipmentDocument",
    entityId: updated.id,
    metadata: {
      shipmentJobId: updated.shipmentJobId,
      documentId: updated.id,
      documentName: updated.documentName,
      status: updated.status,
      version: updated.version,
      fileName: updated.fileName,
    },
  });

  await createCompanyNotification({
    companyId,
    branchId: updated.branchId,
    type: "DOCUMENT_REJECTED",
    title: "Document Rejected",
    message: `${updated.documentName} was rejected for a shipment and requires attention.`,
    linkUrl: `/dashboard/shipments/${updated.shipmentJobId}`,
    metadata: {
      shipmentJobId: updated.shipmentJobId,
      documentId: updated.id,
    },
  });

  const customerRecipient = await prisma.shipmentjob.findFirst({
    where: { id: updated.shipmentJobId, companyId, deletedAt: null },
    select: {
      jobNo: true,
      company: { select: { portalSlug: true } },
      customer: {
        select: {
          clientportalaccount: {
            where: { status: "ACTIVE", deletedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });
  const portalAccount = customerRecipient?.customer.clientportalaccount[0];
  if (portalAccount) {
    await safelyCreateCustomerDeliveries({
      companyId,
      clientPortalAccountId: portalAccount.id,
      key: "document_rejected",
      variables: {
        shipmentNumber: customerRecipient.jobNo,
        status: "REQUIRES_ATTENTION",
      },
      linkUrl: customerRecipient.company.portalSlug
        ? `/portal/${customerRecipient.company.portalSlug}`
        : null,
    });
  }

  revalidateAdminPaths();
  return successState(`${updated.documentName} rejected.`);
}

export async function updateShipmentDocumentRemarks(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:update");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const shipmentJobId = getString(formData, "shipmentJobId");
  const documentId = getString(formData, "documentId");
  const remarks = getString(formData, "remarks") || null;

  const shipment = await getShipmentForDocument(shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment) return validationError("Shipment was not found.");
  if (shipment.closedAt) return validationError("This shipment job is closed and its operational files are locked.");

  const document = await getDocumentForAction(documentId, shipmentJobId, companyId);
  if (!document) return validationError("Document was not found.");
  const moduleError = await ensureModuleAccess(document.companyId, "DOCUMENTS");
  if (moduleError) return validationError(moduleError);

  const updated = await prisma.shipmentdocument.update({
    where: { id: document.id },
    data: { remarks, updatedAt: new Date() },
  });

  await audit({
    companyId: updated.companyId,
    actorId: user.id,
    action: "DOCUMENT_REMARK_UPDATED",
    entityType: "ShipmentDocument",
    entityId: updated.id,
    metadata: {
      shipmentJobId: updated.shipmentJobId,
      documentId: updated.id,
      documentName: updated.documentName,
      status: updated.status,
      version: updated.version,
    },
  });

  revalidateAdminPaths();
  return successState("Remarks updated.");
}

export async function deleteShipmentDocument(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documents:delete");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const shipmentJobId = getString(formData, "shipmentJobId");
  const documentId = getString(formData, "documentId");

  const shipment = await getShipmentForDocument(shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment || shipment.closedAt) return;

  const document = await getDocumentForAction(documentId, shipmentJobId, companyId);
  if (!document) return;
  if (document.status === "VERIFIED") return;
  if (await ensureModuleAccess(document.companyId, "DOCUMENTS")) return;

  const deleted = await prisma.shipmentdocument.update({
    where: { id: document.id },
    data: { deletedAt: new Date(), status: "PENDING", updatedAt: new Date() },
  });

  await audit({
    companyId: deleted.companyId,
    actorId: user.id,
    action: "DOCUMENT_DRAFT_DELETED",
    entityType: "ShipmentDocument",
    entityId: deleted.id,
    metadata: {
      shipmentJobId: deleted.shipmentJobId,
      documentId: deleted.id,
      documentName: deleted.documentName,
      status: deleted.status,
      version: deleted.version,
      fileName: deleted.fileName,
    },
  });

  revalidateAdminPaths();
}
