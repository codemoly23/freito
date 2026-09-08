"use server";

import path from "node:path";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";
import { sanitizeFileName, validateDocumentFile } from "@/lib/documents/storage";
import { blobPut } from "@/lib/blob/client";
import { type ActionState, audit, getFormData, getString, successState, validationError } from "@/lib/actions/helpers";
import { DOCUMENT_MASTER } from "@/lib/documents/config";

export async function uploadPortalShipmentDocument(
  companySlug: string,
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { account } = await requirePortalAccount(companySlug);
  const shipmentJobId = getString(formData, "shipmentJobId");
  const checklistItemId = getString(formData, "checklistItemId");
  const file = formData.get("file");

  const shipment = await prisma.shipmentjob.findFirst({
    where: {
      id: shipmentJobId,
      companyId: account.companyId,
      customerId: account.customerId,
      deletedAt: null,
      shipmentrequest: { clientPortalAccountId: account.id, deletedAt: null },
    },
    select: { id: true, companyId: true, branchId: true, shipmentType: true, closedAt: true },
  });
  if (!shipment) return validationError("Shipment was not found.");
  if (shipment.closedAt) return validationError("This shipment job is closed and its operational files are locked.");

  const checklistItem = await prisma.documentchecklistitem.findFirst({
    where: { id: checklistItemId, isActive: true, OR: [{ companyId: null }, { companyId: account.companyId }], category: { in: [shipment.shipmentType, "COMMON"] } },
  });
  if (!checklistItem) return validationError("Invalid checklist item.");

  // Check portal-safe restriction
  const docConfig = DOCUMENT_MASTER.find(item => item.name.toLowerCase() === checklistItem.name.toLowerCase());
  if (!docConfig || !docConfig.portalVisible) {
    return validationError("Unauthorized document upload for portal user.");
  }

  if (!(file instanceof File)) return validationError("Select a file to upload.");
  const fileError = validateDocumentFile(file);
  if (fileError) return validationError(fileError);

  const current = await prisma.shipmentdocument.findFirst({
    where: { companyId: account.companyId, shipmentJobId: shipment.id, checklistItemId, deletedAt: null },
    orderBy: { version: "desc" },
  });
  if (current?.status === "VERIFIED") return validationError("Verified documents cannot be replaced from the portal.");

  const safeName = sanitizeFileName(file.name);
  const storedName = `${Date.now()}-${randomUUID()}${path.extname(safeName).toLowerCase()}`;
  const blobName = `uploads/${account.companyId}/${shipment.id}/${storedName}`;
  await blobPut(blobName, await file.arrayBuffer(), file.type || "application/octet-stream");

  const version = (current?.version ?? 0) + 1;
  const now = new Date();
  const data = {
    documentName: checklistItem.name,
    documentType: checklistItem.category,
    status: "UPLOADED" as const,
    fileName: storedName,
    originalFileName: safeName,
    filePath: blobName,
    mimeType: file.type,
    fileSize: file.size,
    version,
    remarks: null,
    uploadedById: null,
    verifiedById: null,
    rejectedById: null,
    uploadedAt: now,
    verifiedAt: null,
    rejectedAt: null,
    updatedAt: now,
  };

  const document = await prisma.shipmentdocument.create({
    data: {
      id: randomUUID(),
      companyId: account.companyId,
      branchId: shipment.branchId,
      shipmentJobId: shipment.id,
      checklistItemId,
      ...data,
    }
  });

  await audit({
    companyId: account.companyId,
    action: version > 1 ? "DOCUMENT_REPLACED" : "PORTAL_DOCUMENT_UPLOADED",
    entityType: "ShipmentDocument",
    entityId: document.id,
    metadata: {
      clientPortalAccountId: account.id,
      customerId: account.customerId,
      shipmentJobId: shipment.id,
      documentId: document.id,
      documentName: document.documentName,
      version: document.version,
      fileName: document.fileName,
      ...(version > 1 ? { replacedVersion: version - 1 } : {}),
    },
  });

  revalidatePath(`/portal/${companySlug}/shipments/${shipment.id}`);
  revalidatePath(`/dashboard/shipments/${shipment.id}`);
  return successState(`${document.documentName} uploaded for review.`);
}

export async function uploadMultiplePortalShipmentDocuments(
  companySlug: string,
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { account } = await requirePortalAccount(companySlug);
  const shipmentJobId = getString(formData, "shipmentJobId");
  
  const shipment = await prisma.shipmentjob.findFirst({
    where: {
      id: shipmentJobId,
      companyId: account.companyId,
      customerId: account.customerId,
      deletedAt: null,
      shipmentrequest: { clientPortalAccountId: account.id, deletedAt: null },
    },
    select: { id: true, companyId: true, branchId: true, shipmentType: true, closedAt: true },
  });
  if (!shipment) return validationError("Shipment was not found.");
  if (shipment.closedAt) return validationError("This shipment job is closed and its operational files are locked.");

  const checklist = await prisma.documentchecklistitem.findMany({
    where: { isActive: true, OR: [{ companyId: null }, { companyId: account.companyId }], category: { in: [shipment.shipmentType, "COMMON"] } },
  });

  let uploadedCount = 0;
  const errors: string[] = [];

  for (const item of checklist) {
    const file = formData.get(`file_${item.id}`);
    if (!file || !(file instanceof File) || file.size === 0 || file.name === "") {
      continue;
    }

    // Check portal-safe restriction
    const docConfig = DOCUMENT_MASTER.find(c => c.name.toLowerCase() === item.name.toLowerCase());
    if (!docConfig || !docConfig.portalVisible) {
      errors.push(`${item.name}: Unauthorized document upload for portal user.`);
      continue;
    }

    const fileError = validateDocumentFile(file);
    if (fileError) {
      errors.push(`${item.name}: ${fileError}`);
      continue;
    }

    const current = await prisma.shipmentdocument.findFirst({
      where: { companyId: account.companyId, shipmentJobId: shipment.id, checklistItemId: item.id, deletedAt: null },
      orderBy: { version: "desc" },
    });
    if (current?.status === "VERIFIED") {
      errors.push(`${item.name} is already verified.`);
      continue;
    }

    const safeName = sanitizeFileName(file.name);
    const storedName = `${Date.now()}-${randomUUID()}${path.extname(safeName).toLowerCase()}`;
    const blobName = `uploads/${account.companyId}/${shipment.id}/${storedName}`;
    
    try {
      await blobPut(blobName, await file.arrayBuffer(), file.type || "application/octet-stream");
      
      const version = (current?.version ?? 0) + 1;
      const now = new Date();
      const data = {
        documentName: item.name,
        documentType: item.category,
        status: "UPLOADED" as const,
        fileName: storedName,
        originalFileName: safeName,
        filePath: blobName,
        mimeType: file.type,
        fileSize: file.size,
        version,
        remarks: null,
        uploadedById: null,
        verifiedById: null,
        rejectedById: null,
        uploadedAt: now,
        verifiedAt: null,
        rejectedAt: null,
        updatedAt: now,
      };

      const document = await prisma.shipmentdocument.create({
        data: {
          id: randomUUID(),
          companyId: account.companyId,
          branchId: shipment.branchId,
          shipmentJobId: shipment.id,
          checklistItemId: item.id,
          ...data,
        }
      });

      await audit({
        companyId: account.companyId,
        action: version > 1 ? "DOCUMENT_REPLACED" : "PORTAL_DOCUMENT_UPLOADED",
        entityType: "ShipmentDocument",
        entityId: document.id,
        metadata: {
          clientPortalAccountId: account.id,
          customerId: account.customerId,
          shipmentJobId: shipment.id,
          documentId: document.id,
          documentName: document.documentName,
          version: document.version,
          fileName: document.fileName,
          ...(version > 1 ? { replacedVersion: version - 1 } : {}),
        },
      });

      uploadedCount++;
    } catch {
      errors.push(`Failed to save ${item.name}.`);
    }
  }

  revalidatePath(`/portal/${companySlug}/shipments/${shipment.id}`);
  revalidatePath(`/dashboard/shipments/${shipment.id}`);

  if (errors.length > 0) {
    if (uploadedCount > 0) {
      return validationError(`Uploaded ${uploadedCount} documents, but had errors: ${errors.join("; ")}`);
    }
    return validationError(errors.join("; "));
  }

  if (uploadedCount === 0) {
    return validationError("Please select at least one file to upload.");
  }

  return successState(`Selected document(s) uploaded for review.`);
}
