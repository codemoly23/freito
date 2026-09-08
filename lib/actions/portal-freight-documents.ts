"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requirePortalAccount } from "@/lib/client-portal/access";
import {
  type ActionState,
  audit,
  getFormData,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

// Get portal document and verify scope
async function getPortalDocument(docId: string, companyId: string, customerId: string) {
  return prisma.freightdocument.findFirst({
    where: {
      id: docId,
      companyId,
      isClientVisible: true,
      deletedAt: null,
      shipmentjob: {
        customerId,
        deletedAt: null,
      },
    },
    include: {
      documentversion: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });
}

// Client Portal: Approve a freight document
export async function clientApproveFreightDocument(
  companySlug: string,
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { account } = await requirePortalAccount(companySlug);

  const documentId = getString(formData, "documentId");
  const remarks = getString(formData, "remarks") || null;

  if (!documentId) return validationError("Document ID is required.");

  const doc = await getPortalDocument(documentId, account.companyId, account.customerId);
  if (!doc) return validationError("Document was not found or access is denied.");

  if (doc.status !== "UNDER_REVIEW") {
    return validationError("Document is not in review status.");
  }

  const latestVersion = doc.documentversion[0];
  if (!latestVersion) {
    return validationError("No active document version found.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.freightdocument.update({
      where: { id: doc.id },
      data: { status: "APPROVED", updatedAt: now },
    });

    await tx.documentapproval.create({
      data: {
        id: randomUUID(),
        freightDocumentId: doc.id,
        versionNumber: latestVersion.versionNumber,
        status: "APPROVED",
        approverType: "CLIENT_PORTAL_ACCOUNT",
        portalAccountId: account.id,
        remarks,
        updatedAt: now,
      },
    });
  });

  await audit({
    companyId: account.companyId,
    action: "PORTAL_DOCUMENT_APPROVED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      clientPortalAccountId: account.id,
      documentNo: doc.documentNo,
      version: latestVersion.versionNumber,
      remarks,
    },
  });

  revalidatePath(`/portal/${companySlug}/shipments/${doc.shipmentJobId}`);
  revalidatePath(`/dashboard/shipments/${doc.shipmentJobId}`);
  return successState("Document approved successfully.");
}

// Client Portal: Request correction / Reject a freight document
export async function clientRejectFreightDocument(
  companySlug: string,
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { account } = await requirePortalAccount(companySlug);

  const documentId = getString(formData, "documentId");
  const remarks = getString(formData, "remarks").trim();

  if (!documentId) return validationError("Document ID is required.");
  if (!remarks) return validationError("Correction notes are required.");

  const doc = await getPortalDocument(documentId, account.companyId, account.customerId);
  if (!doc) return validationError("Document was not found or access is denied.");

  if (doc.status !== "UNDER_REVIEW") {
    return validationError("Document is not in review status.");
  }

  const latestVersion = doc.documentversion[0];
  if (!latestVersion) {
    return validationError("No active document version found.");
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.freightdocument.update({
      where: { id: doc.id },
      data: { status: "DRAFT", updatedAt: now }, // Reverts status back to DRAFT for modifications
    });

    await tx.documentapproval.create({
      data: {
        id: randomUUID(),
        freightDocumentId: doc.id,
        versionNumber: latestVersion.versionNumber,
        status: "REJECTED",
        approverType: "CLIENT_PORTAL_ACCOUNT",
        portalAccountId: account.id,
        remarks,
        updatedAt: now,
      },
    });
  });

  await audit({
    companyId: account.companyId,
    action: "PORTAL_DOCUMENT_REJECTED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      clientPortalAccountId: account.id,
      documentNo: doc.documentNo,
      version: latestVersion.versionNumber,
      remarks,
    },
  });

  revalidatePath(`/portal/${companySlug}/shipments/${doc.shipmentJobId}`);
  revalidatePath(`/dashboard/shipments/${doc.shipmentJobId}`);
  return successState("Correction request submitted.");
}
