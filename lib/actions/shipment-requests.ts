"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { ensureActiveCompanyAccess, ensureModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getBranchWriteScope, getCompanyDefaultBranchId } from "@/lib/access/branch-access";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { defaultShipmentStatus } from "@/lib/shipments/constants";
import { createWorkflowSteps } from "@/lib/shipments/workflow";
import { requirePermission } from "@/lib/permissions/rbac";
import {
  createClientPortalNotification,
  createCompanyNotification,
} from "@/lib/notifications/create-notification";
import { safelyCreateCustomerDeliveries } from "@/lib/notifications/templates";
import {
  dashboardShipmentRequestSchema,
  portalQuotationResponseSchema,
  shipmentRequestSchema,
  shipmentRequestStatusSchema,
} from "@/lib/validators/shipment-requests";
import {
  revalidateQuotationPaths,
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";
import { copyQuotationChargesToShipmentJob } from "@/lib/finance/calculations";

async function getPortalContext(companySlug: string) {
  const user = await getCurrentUser();
  if (
    !user ||
    user.scope !== "CLIENT" ||
    !user.companyId ||
    !user.customerId ||
    !user.clientPortalAccountId ||
    user.companySlug !== companySlug
  ) {
    redirect(`/portal/${companySlug}/login`);
  }
  const companyError = await ensureActiveCompanyAccess(user.companyId);
  if (companyError) redirect(`/portal/${companySlug}/login`);
  if (await ensureModuleAccess(user.companyId, "CLIENT_PORTAL")) {
    redirect(`/portal/${companySlug}/login`);
  }
  const account = await prisma.clientportalaccount.findFirst({
    where: {
      id: user.clientPortalAccountId,
      companyId: user.companyId,
      customerId: user.customerId,
      status: "ACTIVE",
      deletedAt: null,
      company: { portalSlug: companySlug, portalEnabled: true },
    },
    select: { id: true },
  });
  if (!account) redirect(`/portal/${companySlug}/login`);
  return {
    user,
    companyId: user.companyId,
    customerId: user.customerId,
    accountId: user.clientPortalAccountId,
  };
}

function requestInput(formData: FormData) {
  const requestedEtd = getString(formData, "requestedEtd");
  const requestedEta = getString(formData, "requestedEta");
  const expectedShipmentDate = getString(formData, "expectedShipmentDate") || requestedEtd;
  const expectedDeliveryDate = getString(formData, "expectedDeliveryDate") || requestedEta;

  return {
    shipmentType: getString(formData, "shipmentType"),
    transportMode: getString(formData, "transportMode"),
    serviceScope: getString(formData, "serviceScope"),
    loadType: getString(formData, "loadType") || null,
    incoterm: getString(formData, "incoterm") || null,
    originCountry: getString(formData, "originCountry"),
    originPort: getString(formData, "originPort"),
    originAddress: getString(formData, "originAddress"),
    destinationCountry: getString(formData, "destinationCountry"),
    destinationPort: getString(formData, "destinationPort"),
    destinationAddress: getString(formData, "destinationAddress"),
    pickupAddress: getString(formData, "pickupAddress"),
    deliveryAddress: getString(formData, "deliveryAddress"),
    cargoDescription: getString(formData, "cargoDescription"),
    commodity: getString(formData, "commodity"),
    hsCode: getString(formData, "hsCode"),
    packageType: getString(formData, "packageType"),
    packageCount: getString(formData, "packageCount"),
    grossWeight: getString(formData, "grossWeight"),
    netWeight: getString(formData, "netWeight"),
    chargeableWeight: getString(formData, "chargeableWeight"),
    cbm: getString(formData, "cbm"),
    readyDate: getString(formData, "readyDate"),
    expectedShipmentDate,
    expectedDeliveryDate,
    customerReference: getString(formData, "customerReference"),
    customerNotes: getString(formData, "customerNotes"),
    containerRequirement: getString(formData, "containerRequirement"),
    specialHandlingNote: getString(formData, "specialHandlingNote"),
    isDangerousGoods: formData.get("isDangerousGoods") === "on",
    isReefer: formData.get("isReefer") === "on",
    isFragile: formData.get("isFragile") === "on",
    requestedEtd,
    requestedEta,
    internalNotes: getString(formData, "internalNotes"),
    shipperName: getString(formData, "shipperName"),
    shipperAddress: getString(formData, "shipperAddress"),
    consigneeName: getString(formData, "consigneeName"),
    consigneeAddress: getString(formData, "consigneeAddress"),
    consigneeBin: getString(formData, "consigneeBin"),
    notifyPartyName: getString(formData, "notifyPartyName"),
    notifyPartyAddress: getString(formData, "notifyPartyAddress"),
    notifyPartyBin: getString(formData, "notifyPartyBin"),
  };
}

async function generateRequestNo(
  tx: Prisma.TransactionClient,
  companyId: string,
) {
  const year = new Date().getFullYear();
  const existing = await tx.shipmentrequest.findMany({
    where: { companyId, requestNo: { startsWith: `REQ-${year}-` } },
    select: { requestNo: true },
  });
  const max = existing.reduce((value, request) => {
    const sequence = Number(request.requestNo.split("-").at(-1));
    return Number.isFinite(sequence) ? Math.max(value, sequence) : value;
  }, 0);
  const now = new Date();
  const sequence = await tx.shipmentrequestsequence.upsert({
    where: { companyId_year: { companyId, year } },
    create: { id: randomUUID(), companyId, year, currentSequence: max + 1, updatedAt: now },
    update: { currentSequence: { increment: 1 }, updatedAt: now },
    select: { currentSequence: true },
  });

  let currentSeq = sequence.currentSequence;
  if (currentSeq <= max) {
    const nextSeq = max + 1;
    await tx.shipmentrequestsequence.update({
      where: { companyId_year: { companyId, year } },
      data: { currentSequence: nextSeq, updatedAt: now },
    });
    currentSeq = nextSeq;
  }

  return `REQ-${year}-${String(currentSeq).padStart(4, "0")}`;
}

async function generateQuoteNo(
  tx: Prisma.TransactionClient,
  companyId: string,
) {
  const year = new Date().getFullYear();
  const existing = await tx.quotation.findMany({
    where: { companyId, quoteNo: { contains: `QT-${year}-` } },
    select: { quoteNo: true },
  });
  const max = existing.reduce((value, quotation) => {
    const sequence = Number(quotation.quoteNo.split("-").at(-1));
    return Number.isFinite(sequence) ? Math.max(value, sequence) : value;
  }, 0);
  const now = new Date();
  const sequence = await tx.quotationsequence.upsert({
    where: { companyId_year: { companyId, year } },
    create: { id: randomUUID(), companyId, year, currentSequence: max + 1, updatedAt: now },
    update: { currentSequence: { increment: 1 }, updatedAt: now },
    select: { currentSequence: true },
  });

  let currentSeq = sequence.currentSequence;
  if (currentSeq <= max) {
    const nextSeq = max + 1;
    await tx.quotationsequence.update({
      where: { companyId_year: { companyId, year } },
      data: { currentSequence: nextSeq, updatedAt: now },
    });
    currentSeq = nextSeq;
  }

  return `QT-${year}-${String(currentSeq).padStart(4, "0")}`;
}

async function generateJobNo(
  tx: Prisma.TransactionClient,
  companyId: string,
  shipmentType: string,
  transportMode: string,
) {
  const year = new Date().getFullYear();
  const typeCode = shipmentType === "EXPORT" ? "EXP" : "IMP";
  const prefix = `${transportMode}-${typeCode}-${year}`;
  const existing = await tx.shipmentjob.findMany({
    where: { companyId, jobNo: { contains: `-${year}-` } },
    select: { jobNo: true },
  });
  const max = existing.reduce((value, shipment) => {
    const sequence = Number(shipment.jobNo.split("-").at(-1));
    return Number.isFinite(sequence) ? Math.max(value, sequence) : value;
  }, 0);
  const now = new Date();
  const sequence = await tx.shipmentjobsequence.upsert({
    where: { companyId_year: { companyId, year } },
    create: { id: randomUUID(), companyId, year, currentSequence: max + 1, updatedAt: now },
    update: { currentSequence: { increment: 1 }, updatedAt: now },
    select: { currentSequence: true },
  });

  let currentSeq = sequence.currentSequence;
  if (currentSeq <= max) {
    const nextSeq = max + 1;
    await tx.shipmentjobsequence.update({
      where: { companyId_year: { companyId, year } },
      data: { currentSequence: nextSeq, updatedAt: now },
    });
    currentSeq = nextSeq;
  }

  return `${prefix}-${String(currentSeq).padStart(4, "0")}`;
}

export async function createPortalShipmentRequest(
  companySlug: string,
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { companyId, customerId, accountId } =
    await getPortalContext(companySlug);
  const branchId = await getCompanyDefaultBranchId(companyId);
  if (!branchId) return validationError("This company has no active branch available for new requests.");

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, phone: true, email: true },
  });

  if (!customer || !customer.name?.trim() || !customer.phone?.trim() || !customer.email?.trim()) {
    return validationError(
      "Customer name, phone number, and email must be filled to submit a shipment request.",
    );
  }

  const parsed = shipmentRequestSchema.safeParse(requestInput(formData));
  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted request fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const request = await prisma.$transaction(async (tx) => {
    const requestNo = await generateRequestNo(tx, companyId);
    const now = new Date();
    const created = await tx.shipmentrequest.create({
      data: {
        id: randomUUID(),
        ...parsed.data,
        companyId,
        branchId,
        customerId,
        clientPortalAccountId: accountId,
        source: "CLIENT_PORTAL",
        requestNo,
        status: "SUBMITTED",
        submittedAt: now,
        updatedAt: now,
      },
    });
    await createCompanyNotification({
      db: tx,
      companyId,
      branchId,
      type: "SHIPMENT_REQUEST_SUBMITTED",
      title: "New Shipment Request",
      message: `Shipment request ${created.requestNo} was submitted through the client portal.`,
      linkUrl: `/dashboard/shipment-requests/${created.id}`,
      metadata: { shipmentRequestId: created.id, requestNo: created.requestNo },
    });
    await safelyCreateCustomerDeliveries({
      db: tx,
      companyId,
      clientPortalAccountId: accountId,
      key: "shipment_request_submitted",
      variables: {
        requestNumber: created.requestNo,
        status: created.status,
      },
      linkUrl: `/portal/${companySlug}/requests/${created.id}`,
    });
    return created;
  });
  await audit({
    companyId,
    action: "SHIPMENT_REQUEST_CREATED",
    entityType: "ShipmentRequest",
    entityId: request.id,
    metadata: { requestNo: request.requestNo, customerId, portal: true },
  });
  revalidatePath(`/portal/${companySlug}/requests`);
  return successState(`Shipment request ${request.requestNo} submitted.`);
}

export async function createDashboardShipmentRequest(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const user = await requirePermission("shipmentRequests:create");
  const companyId = user.companyId ?? "";
  const { defaultBranchId } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  if (!defaultBranchId) return validationError("Assign an active default branch before creating a request.");

  const customerId = getString(formData, "customerId");
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId, deletedAt: null },
    select: { id: true, name: true, phone: true, email: true },
  });

  if (!customer) {
    return validationError("Selected customer not found or access denied.");
  }

  if (!customer.name?.trim() || !customer.phone?.trim() || !customer.email?.trim()) {
    return validationError(
      "Customer name, phone number, and email must be filled to submit a shipment request.",
    );
  }

  const parsed = dashboardShipmentRequestSchema.safeParse({
    ...requestInput(formData),
    customerId,
  });
  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted request fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { customerId: _, ...fields } = parsed.data;

  let request;
  try {
    request = await prisma.$transaction(async (tx) => {
      const requestNo = await generateRequestNo(tx, companyId);
      const now = new Date();
      const created = await tx.shipmentrequest.create({
        data: {
          id: randomUUID(),
          ...fields,
          companyId,
          branchId: defaultBranchId,
          customerId,
          createdById: user.id,
          source: "COMPANY_DASHBOARD",
          requestNo,
          status: "SUBMITTED",
          submittedAt: now,
          updatedAt: now,
        },
      });
      return created;
    });
  } catch (error) {
    console.error("Failed to create dashboard shipment request:", error);
    return validationError("Failed to create shipment request due to database error.");
  }

  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_REQUEST_CREATED",
    entityType: "ShipmentRequest",
    entityId: request.id,
    metadata: {
      requestNo: request.requestNo,
      customerId,
      createdBy: user.name ?? user.email,
      source: "COMPANY_DASHBOARD",
    },
  });

  revalidatePath("/dashboard/shipment-requests");
  redirect("/dashboard/shipment-requests");
}

export async function updateShipmentRequest(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("shipmentRequests:update");
  if (await ensureModuleAccess(companyId, "SHIPMENTS")) {
    return validationError("The Shipments module is not enabled.");
  }
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const id = getString(formData, "id");
  const request = await prisma.shipmentrequest.findFirst({
    where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
  });
  if (!request) return validationError("Shipment request was not found.");
  if (["CONVERTED", "CANCELLED"].includes(request.status)) {
    return validationError("This request is locked and cannot be edited.");
  }
  const parsed = shipmentRequestSchema.safeParse(requestInput(formData));
  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted request fields.",
      parsed.error.flatten().fieldErrors,
    );
  }
  await prisma.shipmentrequest.update({
    where: { id },
    data: { ...parsed.data, updatedById: user.id, updatedAt: new Date() },
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_REQUEST_UPDATED",
    entityType: "ShipmentRequest",
    entityId: id,
    metadata: { requestNo: request.requestNo },
  });
  revalidatePath(`/dashboard/shipment-requests/${id}`);
  return successState("Shipment request updated.");
}

export async function updateShipmentRequestStatus(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("shipmentRequests:update");
  if (await ensureModuleAccess(companyId, "SHIPMENTS")) {
    return validationError("The Shipments module is not enabled.");
  }
  const parsed = shipmentRequestStatusSchema.safeParse({
    shipmentRequestId: getString(formData, "shipmentRequestId"),
    status: getString(formData, "status"),
    internalNotes: getString(formData, "internalNotes"),
  });
  if (!parsed.success) return validationError("Select a valid request status.");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const request = await prisma.shipmentrequest.findFirst({
    where: {
      id: parsed.data.shipmentRequestId,
      companyId,
      deletedAt: null,
      ...branchScopeWhere(accessibleBranchIds),
    },
  });
  if (!request) return validationError("Shipment request was not found.");
  if (["CONVERTED", "ACCEPTED", "REJECTED"].includes(request.status)) {
    return validationError("This request status cannot be changed manually.");
  }
  await prisma.shipmentrequest.update({
    where: { id: request.id },
    data: {
      status: parsed.data.status,
      internalNotes: parsed.data.internalNotes,
      updatedById: user.id,
      updatedAt: new Date(),
    },
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_REQUEST_STATUS_CHANGED",
    entityType: "ShipmentRequest",
    entityId: request.id,
    metadata: {
      requestNo: request.requestNo,
      from: request.status,
      to: parsed.data.status,
    },
  });
  revalidatePath(`/dashboard/shipment-requests/${request.id}`);
  return successState("Request status updated.");
}

export async function createQuotationFromRequest(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("shipmentRequests:quote");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  if (await ensureModuleAccess(companyId, "SHIPMENTS")) {
    return validationError("The Shipments module is not enabled.");
  }
  if (await ensureModuleAccess(companyId, "QUOTATIONS")) {
    return validationError("The Quotations module is not enabled.");
  }
  const id = getString(formData, "shipmentRequestId");
  const request = await prisma.shipmentrequest.findFirst({
    where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
  });
  if (!request) return validationError("Shipment request was not found.");
  if (["ACCEPTED", "REJECTED", "CONVERTED", "CANCELLED"].includes(request.status)) {
    return validationError("A quotation cannot be created for this request status.");
  }
  if (request.status === "QUOTED") {
    const activeQuotation = await prisma.quotation.findFirst({
      where: {
        shipmentRequestId: request.id,
        companyId,
        branchId: request.branchId,
        status: { in: ["DRAFT", "SENT"] },
        deletedAt: null,
      },
      select: { id: true },
    });
    if (activeQuotation) {
      return validationError(
        "An active quotation already exists. Update it or wait for a revision request.",
      );
    }
  }

  const quotation = await prisma.$transaction(async (tx) => {
    const quoteNo = await generateQuoteNo(tx, companyId);
    const now = new Date();
    const created = await tx.quotation.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId: request.branchId,
        customerId: request.customerId,
        shipmentRequestId: request.id,
        quoteNo,
        status: "DRAFT",
        shipmentType: request.shipmentType,
        transportMode: request.transportMode,
        loadType: request.loadType,
        tradeTerm: request.incoterm,
        originCountry: request.originCountry,
        originPort: request.originPort,
        destinationCountry: request.destinationCountry,
        destinationPort: request.destinationPort,
        cargoDescription: request.cargoDescription,
        packageCount: request.packageCount,
        grossWeight: request.grossWeight,
        chargeableWeight: request.chargeableWeight,
        cbm: request.cbm,
        createdById: user.id,
        updatedAt: now,
      },
    });
    await tx.shipmentrequest.update({
      where: { id: request.id },
      data: {
        status: "QUOTED",
        quotedAt: now,
        updatedById: user.id,
        updatedAt: now,
      },
    });
    if (request.clientPortalAccountId) {
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { portalSlug: true },
      });
      const notification = await createClientPortalNotification({
        db: tx,
        companyId,
        clientPortalAccountId: request.clientPortalAccountId,
        type: "QUOTATION_CREATED",
        title: "New Quotation Available",
        message: `Quotation ${created.quoteNo} has been created for request ${request.requestNo}.`,
        linkUrl: company?.portalSlug
          ? `/portal/${company.portalSlug}/requests/${request.id}`
          : null,
      });
      await safelyCreateCustomerDeliveries({
        db: tx,
        companyId,
        clientPortalAccountId: request.clientPortalAccountId,
        key: "quotation_created",
        variables: {
          requestNumber: request.requestNo,
          quotationNumber: created.quoteNo,
          status: "QUOTED",
        },
        linkUrl: company?.portalSlug
          ? `/portal/${company.portalSlug}/requests/${request.id}`
          : null,
        notificationId: notification.id,
      });
    }
    return created;
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_REQUEST_QUOTATION_CREATED",
    entityType: "ShipmentRequest",
    entityId: request.id,
    metadata: {
      requestNo: request.requestNo,
      quotationId: quotation.id,
      quoteNo: quotation.quoteNo,
    },
  });
  revalidatePath(`/dashboard/shipment-requests/${request.id}`);
  revalidateQuotationPaths(quotation.id);
  return successState(`Quotation ${quotation.quoteNo} created.`);
}

export async function respondToPortalQuotation(
  companySlug: string,
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { companyId, customerId, accountId } =
    await getPortalContext(companySlug);
  const parsed = portalQuotationResponseSchema.safeParse({
    shipmentRequestId: getString(formData, "shipmentRequestId"),
    quotationId: getString(formData, "quotationId"),
    action: getString(formData, "action"),
    message: getString(formData, "message"),
  });
  if (!parsed.success) return validationError("Invalid quotation response.");
  const request = await prisma.shipmentrequest.findFirst({
    where: {
      id: parsed.data.shipmentRequestId,
      companyId,
      customerId,
      clientPortalAccountId: accountId,
      deletedAt: null,
    },
  });
  const quotation = request
    ? await prisma.quotation.findFirst({
        where: {
          id: parsed.data.quotationId,
          shipmentRequestId: request.id,
          companyId,
          customerId,
          status: "SENT",
          deletedAt: null,
        },
      })
    : null;
  if (!request || !quotation) {
    return validationError("Quotation was not found or is not available.");
  }
  if (request.status !== "QUOTED") {
    return validationError(
      "This quotation is no longer available for a response.",
    );
  }
  const latestAvailable = await prisma.quotation.findFirst({
    where: {
      shipmentRequestId: request.id,
      companyId,
      customerId,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (
    latestAvailable?.id !== quotation.id ||
    latestAvailable.status !== "SENT"
  ) {
    return validationError("A newer quotation is available for this request.");
  }

  const now = new Date();
  const status =
    parsed.data.action === "ACCEPT"
      ? "ACCEPTED"
      : parsed.data.action === "REJECT"
        ? "REJECTED"
        : "REVISION_REQUESTED";
  await prisma.$transaction(async (tx) => {
    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        status:
          parsed.data.action === "ACCEPT"
            ? "ACCEPTED"
            : parsed.data.action === "REJECT"
              ? "REJECTED"
              : "EXPIRED",
        approvedAt:
          parsed.data.action === "ACCEPT" || parsed.data.action === "REJECT"
            ? now
            : quotation.approvedAt,
        updatedAt: now,
      },
    });
    await tx.shipmentrequest.update({
      where: { id: request.id },
      data: {
        status,
        acceptedAt: parsed.data.action === "ACCEPT" ? now : null,
        rejectedAt: parsed.data.action === "REJECT" ? now : null,
        rejectionReason:
          parsed.data.action === "REJECT" ? parsed.data.message : null,
        revisionMessage:
          parsed.data.action === "REVISION" ? parsed.data.message : null,
        updatedAt: now,
      },
    });
    await createCompanyNotification({
      db: tx,
      companyId,
      branchId: request.branchId,
      type:
        parsed.data.action === "ACCEPT"
          ? "QUOTATION_ACCEPTED"
          : parsed.data.action === "REJECT"
            ? "QUOTATION_REJECTED"
            : "QUOTATION_REVISION_REQUESTED",
      title:
        parsed.data.action === "ACCEPT"
          ? "Quotation Accepted"
          : parsed.data.action === "REJECT"
            ? "Quotation Rejected"
            : "Revision Requested",
      message:
        parsed.data.action === "ACCEPT"
          ? `The customer accepted quotation ${quotation.quoteNo} for request ${request.requestNo}.`
          : parsed.data.action === "REJECT"
            ? `The customer rejected quotation ${quotation.quoteNo} for request ${request.requestNo}.`
            : `The customer requested a revision for quotation ${quotation.quoteNo} on request ${request.requestNo}.`,
      linkUrl: `/dashboard/shipment-requests/${request.id}`,
      metadata: {
        shipmentRequestId: request.id,
        quotationId: quotation.id,
        response: parsed.data.action,
      },
    });
    await safelyCreateCustomerDeliveries({
      db: tx,
      companyId,
      clientPortalAccountId: accountId,
      key:
        parsed.data.action === "ACCEPT"
          ? "quotation_accepted"
          : parsed.data.action === "REJECT"
            ? "quotation_rejected"
            : "quotation_revision_requested",
      variables: {
        requestNumber: request.requestNo,
        quotationNumber: quotation.quoteNo,
        status,
      },
      linkUrl: `/portal/${companySlug}/requests/${request.id}`,
    });
  });
  const action =
    parsed.data.action === "ACCEPT"
      ? "SHIPMENT_REQUEST_ACCEPTED"
      : parsed.data.action === "REJECT"
        ? "SHIPMENT_REQUEST_REJECTED"
        : "SHIPMENT_REQUEST_REVISION_REQUESTED";
  await audit({
    companyId,
    action,
    entityType: "ShipmentRequest",
    entityId: request.id,
    metadata: {
      requestNo: request.requestNo,
      quotationId: quotation.id,
      portalAccountId: accountId,
      message: parsed.data.message,
    },
  });
  revalidatePath(`/portal/${companySlug}/requests/${request.id}`);
  return successState(
    parsed.data.action === "ACCEPT"
      ? "Quotation accepted."
      : parsed.data.action === "REJECT"
        ? "Quotation rejected."
        : "Revision requested.",
  );
}

export async function convertAcceptedRequestToShipment(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("shipmentRequests:convert");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  if (await ensureModuleAccess(companyId, "SHIPMENTS")) {
    return validationError("The Shipments module is not enabled.");
  }
  const requestId = getString(formData, "shipmentRequestId");
  const quotationId = getString(formData, "quotationId");
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.shipmentrequest.findFirst({
      where: { id: requestId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    });
    const quotation = request
      ? await tx.quotation.findFirst({
          where: {
            id: quotationId,
            companyId,
            ...branchScopeWhere(accessibleBranchIds),
            customerId: request.customerId,
            shipmentRequestId: request.id,
            status: "ACCEPTED",
            convertedShipmentJobId: null,
            deletedAt: null,
          },
        })
      : null;
    if (!request || !quotation) {
      return {
        ok: false as const,
        message:
          "This request has already been converted or is no longer eligible for conversion.",
      };
    }

    const now = new Date();
    const claim = await tx.shipmentrequest.updateMany({
      where: {
        id: request.id,
        companyId,
        status: "ACCEPTED",
        convertedShipmentJobId: null,
        deletedAt: null,
      },
      data: {
        status: "CONVERTED",
        updatedById: user.id,
        updatedAt: now,
      },
    });
    if (claim.count !== 1) {
      return {
        ok: false as const,
        message:
          "This request has already been converted or is no longer eligible for conversion.",
      };
    }

    const jobNo = await generateJobNo(
      tx,
      companyId,
      request.shipmentType,
      request.transportMode,
    );
    const currentStatus = defaultShipmentStatus(request.shipmentType);
    const created = await tx.shipmentjob.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId: request.branchId,
        jobNo,
        customerId: request.customerId,
        shipmentType: request.shipmentType,
        transportMode: request.transportMode,
        loadType:
          request.loadType ??
          (request.transportMode === "AIR"
            ? "AIR_CARGO"
            : request.transportMode === "LAND"
              ? "TRUCK"
              : "FCL"),
        tradeTerm: request.incoterm,
        serviceScope: request.serviceScope,
        originCountry: request.originCountry,
        originPort: request.originPort,
        destinationCountry: request.destinationCountry,
        destinationPort: request.destinationPort,
        placeOfReceipt: request.originAddress,
        placeOfDelivery: request.destinationAddress,
        pickupAddress: request.pickupAddress,
        deliveryAddress: request.deliveryAddress,
        cargoDescription: request.cargoDescription,
        hsCode: request.hsCode,
        packageCount: request.packageCount,
        packageType: request.packageType,
        grossWeight: request.grossWeight,
        chargeableWeight: request.chargeableWeight,
        cbm: request.cbm,
        etd: request.expectedShipmentDate,
        eta: request.expectedDeliveryDate,
        assignedToId: user.id,
        createdById: user.id,
        currentStatus,
        shipperName: request.shipperName,
        shipperAddress: request.shipperAddress,
        consigneeName: request.consigneeName,
        consigneeAddress: request.consigneeAddress,
        consigneeBin: request.consigneeBin,
        notifyPartyName: request.notifyPartyName,
        notifyPartyAddress: request.notifyPartyAddress,
        notifyPartyBin: request.notifyPartyBin,
        updatedAt: now,
        shipmentstatusevent: {
          create: {
            id: randomUUID(),
            companyId,
            status: currentStatus,
            remarks: `Created from request ${request.requestNo}`,
            updatedById: user.id,
          },
        },
      },
    });
    await createWorkflowSteps({
      tx,
      companyId,
      shipmentJobId: created.id,
      serviceScope: request.serviceScope,
      actorId: user.id,
    });
    await copyQuotationChargesToShipmentJob(tx, quotation.id, created.id, user.id);
    await tx.shipmentrequest.update({
      where: { id: request.id },
      data: {
        status: "CONVERTED",
        convertedAt: now,
        convertedShipmentJobId: created.id,
        updatedById: user.id,
        updatedAt: now,
      },
    });
    await tx.quotation.update({
      where: {
        id: quotation.id,
      },
      data: {
        status: "CONVERTED",
        convertedShipmentJobId: created.id,
        updatedAt: now,
      },
    });
    await tx.auditlog.create({
      data: {
        id: randomUUID(),
        companyId,
        actorId: user.id,
        action: "SHIPMENT_REQUEST_CONVERTED_TO_SHIPMENT",
        entityType: "ShipmentRequest",
        entityId: request.id,
        metadata: JSON.stringify({
          requestNo: request.requestNo,
          quotationId: quotation.id,
          shipmentJobId: created.id,
          jobNo: created.jobNo,
          serviceScope: request.serviceScope,
        }),
      },
    });
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: { portalSlug: true },
    });
    if (request.clientPortalAccountId) {
      const notification = await createClientPortalNotification({
        db: tx,
        companyId,
        clientPortalAccountId: request.clientPortalAccountId,
        type: "SHIPMENT_CREATED",
        title: "Shipment Created",
        message: `Shipment ${created.jobNo} was created from request ${request.requestNo}.`,
        linkUrl: company?.portalSlug
          ? `/portal/${company.portalSlug}/requests/${request.id}`
          : null,
      });
      await safelyCreateCustomerDeliveries({
        db: tx,
        companyId,
        clientPortalAccountId: request.clientPortalAccountId,
        key: "shipment_created",
        variables: {
          requestNumber: request.requestNo,
          quotationNumber: quotation.quoteNo,
          shipmentNumber: created.jobNo,
          status: "CREATED",
        },
        linkUrl: company?.portalSlug
          ? `/portal/${company.portalSlug}/requests/${request.id}`
          : null,
        notificationId: notification.id,
      });
    }
    await createCompanyNotification({
      db: tx,
      companyId,
      branchId: created.branchId,
      type: "REQUEST_CONVERTED_TO_SHIPMENT",
      title: "Shipment Created from Request",
      message: `Shipment ${created.jobNo} was created from request ${request.requestNo}.`,
      linkUrl: `/dashboard/shipments/${created.id}`,
      metadata: {
        shipmentRequestId: request.id,
        shipmentJobId: created.id,
        jobNo: created.jobNo,
      },
    });
    return { ok: true as const, shipment: created };
  }, { timeout: 20000 });
  if (!result.ok) return validationError(result.message);

  revalidatePath(`/dashboard/shipment-requests/${requestId}`);
  revalidatePath(`/dashboard/shipments/${result.shipment.id}`);
  return successState(`Shipment ${result.shipment.jobNo} created.`);
}

export async function deleteShipmentRequest(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("shipmentRequests:delete");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  if (await ensureModuleAccess(companyId, "SHIPMENTS")) return;
  const id = getString(formData, "id");
  const request = await prisma.shipmentrequest.findFirst({
    where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
  });
  if (!request || request.status === "CONVERTED") return;
  await prisma.shipmentrequest.update({
    where: { id },
    data: { deletedAt: new Date(), updatedById: user.id, updatedAt: new Date() },
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "SHIPMENT_REQUEST_DELETED",
    entityType: "ShipmentRequest",
    entityId: id,
    metadata: { requestNo: request.requestNo },
  });
  revalidatePath("/dashboard/shipment-requests");
}

export async function convertDirectCompanyRequestToShipment(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("shipmentRequests:convert");
  if (await ensureModuleAccess(companyId, "SHIPMENTS")) {
    return validationError("The Shipments module is not enabled.");
  }
  const requestId = getString(formData, "shipmentRequestId");
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.shipmentrequest.findFirst({
      where: { id: requestId, companyId, deletedAt: null },
    });
    if (!request || request.status === "CONVERTED" || !request.createdById) {
      return {
        ok: false as const,
        message:
          "This request has already been converted, or is not an internally created request.",
      };
    }

    const now = new Date();
    const claim = await tx.shipmentrequest.updateMany({
      where: {
        id: request.id,
        companyId,
        status: { not: "CONVERTED" },
        convertedShipmentJobId: null,
        deletedAt: null,
      },
      data: {
        status: "CONVERTED",
        updatedById: user.id,
        updatedAt: now,
      },
    });
    if (claim.count !== 1) {
      return {
        ok: false as const,
        message:
          "This request has already been converted or is no longer eligible for conversion.",
      };
    }

    const jobNo = await generateJobNo(
      tx,
      companyId,
      request.shipmentType,
      request.transportMode,
    );
    const currentStatus = defaultShipmentStatus(request.shipmentType);
    const created = await tx.shipmentjob.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId: request.branchId,
        jobNo,
        customerId: request.customerId,
        shipmentType: request.shipmentType,
        transportMode: request.transportMode,
        loadType:
          request.loadType ??
          (request.transportMode === "AIR"
            ? "AIR_CARGO"
            : request.transportMode === "LAND"
              ? "TRUCK"
              : "FCL"),
        tradeTerm: request.incoterm,
        serviceScope: request.serviceScope,
        originCountry: request.originCountry,
        originPort: request.originPort,
        destinationCountry: request.destinationCountry,
        destinationPort: request.destinationPort,
        placeOfReceipt: request.originAddress,
        placeOfDelivery: request.destinationAddress,
        pickupAddress: request.pickupAddress,
        deliveryAddress: request.deliveryAddress,
        cargoDescription: request.cargoDescription,
        hsCode: request.hsCode,
        packageCount: request.packageCount,
        packageType: request.packageType,
        grossWeight: request.grossWeight,
        chargeableWeight: request.chargeableWeight,
        cbm: request.cbm,
        etd: request.expectedShipmentDate,
        eta: request.expectedDeliveryDate,
        assignedToId: user.id,
        createdById: user.id,
        currentStatus,
        shipperName: request.shipperName,
        shipperAddress: request.shipperAddress,
        consigneeName: request.consigneeName,
        consigneeAddress: request.consigneeAddress,
        consigneeBin: request.consigneeBin,
        notifyPartyName: request.notifyPartyName,
        notifyPartyAddress: request.notifyPartyAddress,
        notifyPartyBin: request.notifyPartyBin,
        updatedAt: now,
        shipmentstatusevent: {
          create: {
            id: randomUUID(),
            companyId,
            status: currentStatus,
            remarks: `Created from request ${request.requestNo}`,
            updatedById: user.id,
          },
        },
      },
    });
    await createWorkflowSteps({
      tx,
      companyId,
      shipmentJobId: created.id,
      serviceScope: request.serviceScope,
      actorId: user.id,
    });
    await tx.shipmentrequest.update({
      where: { id: request.id },
      data: {
        status: "CONVERTED",
        convertedAt: now,
        convertedShipmentJobId: created.id,
        updatedById: user.id,
        updatedAt: now,
      },
    });
    await tx.auditlog.create({
      data: {
        id: randomUUID(),
        companyId,
        actorId: user.id,
        action: "SHIPMENT_REQUEST_CONVERTED_TO_SHIPMENT",
        entityType: "ShipmentRequest",
        entityId: request.id,
        metadata: JSON.stringify({
          requestNo: request.requestNo,
          shipmentJobId: created.id,
          jobNo: created.jobNo,
          serviceScope: request.serviceScope,
        }),
      },
    });
    return { ok: true as const, shipment: created };
  }, { timeout: 20000 });
  if (!result.ok) return validationError(result.message);

  revalidatePath(`/dashboard/shipment-requests/${requestId}`);
  revalidatePath(`/dashboard/shipments/${result.shipment.id}`);
  return successState(`Shipment ${result.shipment.jobNo} created.`);
}
