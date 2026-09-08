"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { ensureModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getBranchWriteScope, getCurrentBranchScope } from "@/lib/access/branch-access";
import {
  calculateDocumentTotals,
  calculateLineAmount,
  invoicePaymentStatus,
  vendorBillPaymentStatus,
} from "@/lib/billing/calculations";
import { prisma } from "@/lib/db/prisma";
import { dispatchNotificationEvent, resolveActivePortalAccountId, resolvePortalLinkUrl } from "@/lib/notifications/dispatch-event";
import { recalculateShipmentWorkflow } from "@/lib/actions/shipment-workflow";
import { getDynamicChecklistForShipment } from "@/lib/documents/engine";
import { toBdt } from "@/lib/approvals/money";
import { policyRequiresApproval, resolveApplicablePolicy } from "@/lib/approvals/policy";
import { submitApprovalRequestTx } from "@/lib/approvals/engine";
import { getEligibleApproverUserIds } from "@/lib/approvals/roles";
import {
  billingLineSchema,
  invoiceHeaderSchema,
  paymentSchema,
  paymentUpdateSchema,
  vendorBillHeaderSchema,
} from "@/lib/validators/billing";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

type SequenceKind = "invoice" | "vendorBill" | "payment";

async function nextNumber(
  tx: Prisma.TransactionClient,
  companyId: string,
  kind: SequenceKind,
) {
  const year = new Date().getFullYear();
  const args = {
    where: { companyId_year: { companyId, year } },
    create: { id: crypto.randomUUID(), companyId, year, currentSequence: 1, updatedAt: new Date() },
    update: { currentSequence: { increment: 1 } },
    select: { currentSequence: true },
  };
  const sequence =
    kind === "invoice"
      ? await tx.invoicesequence.upsert(args)
      : kind === "vendorBill"
        ? await tx.vendorbillsequence.upsert(args)
        : await tx.paymentsequence.upsert(args);

  let maxSeq = 0;
  if (kind === "invoice") {
    const invoices = await tx.invoice.findMany({
      where: { companyId, invoiceNo: { startsWith: `INV-${year}-` } },
      select: { invoiceNo: true },
    });
    for (const inv of invoices) {
      const parts = inv.invoiceNo.split("-");
      const seqStr = parts[parts.length - 1];
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  } else if (kind === "vendorBill") {
    const bills = await tx.vendorbill.findMany({
      where: { companyId, billNo: { startsWith: `VB-${year}-` } },
      select: { billNo: true },
    });
    for (const b of bills) {
      const parts = b.billNo.split("-");
      const seqStr = parts[parts.length - 1];
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  } else {
    const payments = await tx.payment.findMany({
      where: { companyId, paymentNo: { startsWith: `PAY-${year}-` } },
      select: { paymentNo: true },
    });
    for (const p of payments) {
      const parts = p.paymentNo.split("-");
      const seqStr = parts[parts.length - 1];
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  let currentSeq = sequence.currentSequence;
  if (currentSeq <= maxSeq) {
    const nextSeq = maxSeq + 1;
    const updateArgs = {
      where: { companyId_year: { companyId, year } },
      data: { currentSequence: nextSeq },
    };
    if (kind === "invoice") {
      await tx.invoicesequence.update(updateArgs);
    } else if (kind === "vendorBill") {
      await tx.vendorbillsequence.update(updateArgs);
    } else {
      await tx.paymentsequence.update(updateArgs);
    }
    currentSeq = nextSeq;
  }

  const prefix = kind === "invoice" ? "INV" : kind === "vendorBill" ? "VB" : "PAY";
  return `${prefix}-${year}-${String(currentSeq).padStart(4, "0")}`;
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

class BillingValidationError extends Error {}

function parseLines(formData: FormData) {
  const descriptions = formData.getAll("lineDescription").map(String);
  const chargeTypes = formData.getAll("lineChargeType").map(String);
  const quantities = formData.getAll("lineQuantity").map(String);
  const prices = formData.getAll("lineUnitPrice").map(String);
  const remarks = formData.getAll("lineRemarks").map(String);
  const lines = descriptions.map((description, index) => ({
    description,
    chargeType: chargeTypes[index] ?? "",
    quantity: quantities[index] ?? "",
    unitPrice: prices[index] ?? "",
    remarks: remarks[index] ?? "",
  }));
  if (!lines.length) return { error: "Add at least one line item." };
  const parsed = lines.map((line) => billingLineSchema.safeParse(line));
  const invalid = parsed.find((item) => !item.success);
  if (invalid && !invalid.success) {
    return {
      error: invalid.error.issues[0]?.message ?? "Check the line items.",
    };
  }
  return { lines: parsed.map((item) => item.data!) };
}

async function requireBilling(permission: Parameters<typeof getScopedCompanyId>[0]) {
  const scoped = await getScopedCompanyId(permission);
  const moduleError = await ensureModuleAccess(scoped.companyId, "BILLING");
  const accessibleBranchIds = await getBranchWriteScope({ userId: scoped.user.id, companyId: scoped.companyId, permissions: scoped.user.permissions ?? [] });
  return { ...scoped, moduleError, accessibleBranchIds: accessibleBranchIds.accessibleBranchIds };
}

// New (unproven) notification dispatch path -- never let it block an
// existing billing write. Every call site below is fire-and-forget-safe.
async function notifySafely(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    console.error("Billing notification dispatch failed.", error instanceof Error ? error.message : error);
  }
}

async function notifyApprovalRequested({
  companyId,
  branchId,
  requestId,
  documentLabel,
  documentNo,
  amountBDT,
}: {
  companyId: string;
  branchId: string;
  requestId: string;
  documentLabel: string;
  documentNo: string;
  amountBDT: Prisma.Decimal;
}) {
  const steps = await prisma.approvalstep.findMany({ where: { requestId }, orderBy: { sequence: "asc" } });
  const firstStep = steps[0];
  if (!firstStep) return;
  const approverIds = await getEligibleApproverUserIds(companyId, branchId, firstStep.approverRoleCode);
  for (const approverId of approverIds) {
    await dispatchNotificationEvent({
      eventKey: "approval_requested",
      companyId,
      branchId,
      entityId: requestId,
      internalRecipientUserId: approverId,
      variables: {
        documentLabel,
        documentNo,
        amount: amountBDT.toFixed(2),
        currency: "BDT",
        stepSequence: 1,
        stepCount: steps.length,
      },
      internalLinkUrl: "/dashboard/approvals",
    });
  }
}

function revalidateBilling() {
  for (const path of [
    "/dashboard/invoices",
    "/dashboard/vendor-bills",
    "/dashboard/payments",
    "/dashboard/receivables",
    "/dashboard/payables",
    "/dashboard/shipments",
  ]) {
    revalidatePath(path);
  }
}

async function lockedFinanceShipmentId(shipmentJobId: string | null | undefined, companyId: string) {
  if (!shipmentJobId) return null;
  const accessibleBranchIds = await getCurrentBranchScope(companyId);
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    select: { id: true, financeCloseStatus: true },
  });
  return shipment?.financeCloseStatus === "LOCKED" ? shipment.id : null;
}

export async function saveInvoice(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const { user, companyId, moduleError } = await requireBilling(
    id ? "invoices:update" : "invoices:create",
  );
  if (moduleError) return validationError(moduleError);
  const { defaultBranchId, accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const parsed = invoiceHeaderSchema.safeParse({
    id,
    customerId: getString(formData, "customerId"),
    shipmentJobId: getString(formData, "shipmentJobId"),
    quotationId: getString(formData, "quotationId"),
    invoiceDate: getString(formData, "invoiceDate"),
    dueDate: getString(formData, "dueDate"),
    currency: getString(formData, "currency") || "BDT",
    exchangeRateToBDT: getString(formData, "exchangeRateToBDT") || "1",
    discountAmount: getString(formData, "discountAmount") || "0",
    taxAmount: getString(formData, "taxAmount") || "0",
    remarks: getString(formData, "remarks"),
  });
  if (!parsed.success) {
    return validationError("Please fix the invoice fields.", parsed.error.flatten().fieldErrors);
  }
  const lineResult = parseLines(formData);
  if (!lineResult.lines) return validationError(lineResult.error ?? "Add invoice lines.");

  const [customer, shipment, quotation] = await Promise.all([
    prisma.customer.findFirst({ where: { id: parsed.data.customerId, companyId, deletedAt: null } }),
    parsed.data.shipmentJobId
      ? prisma.shipmentjob.findFirst({ where: { id: parsed.data.shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } })
      : null,
    parsed.data.quotationId
      ? prisma.quotation.findFirst({ where: { id: parsed.data.quotationId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } })
      : null,
  ]);
  if (!customer) return validationError("Select a valid customer from this company.");
  if (parsed.data.shipmentJobId && !shipment) return validationError("Select a valid shipment from this company.");
  if (parsed.data.quotationId && !quotation) return validationError("Select a valid quotation from this company.");
  if (shipment && shipment.customerId !== customer.id) {
    return validationError("The shipment customer does not match the invoice customer.");
  }
  
  if (parsed.data.shipmentJobId) {
    const checklist = await getDynamicChecklistForShipment(parsed.data.shipmentJobId);
    const invoiceMandatory = checklist.filter(item => item.mandatoryBeforeInvoice);
    if (invoiceMandatory.length > 0) {
      const uploadedDocs = await prisma.shipmentdocument.findMany({
        where: { shipmentJobId: parsed.data.shipmentJobId, deletedAt: null },
      });
      for (const item of invoiceMandatory) {
        const hasDoc = uploadedDocs.some(
          doc => doc.documentName.toLowerCase() === item.name.toLowerCase() && doc.status !== "PENDING" && doc.status !== "REJECTED"
        );
        if (!hasDoc) {
          return validationError(`Cannot save invoice: mandatory document '${item.name}' is missing.`);
        }
      }
    }
  }
  if (quotation && quotation.customerId !== customer.id) {
    return validationError("The quotation customer does not match the invoice customer.");
  }
  const amounts = lineResult.lines.map((line) =>
    calculateLineAmount(line.quantity, line.unitPrice),
  );
  const totals = calculateDocumentTotals(
    amounts,
    parsed.data.discountAmount,
    parsed.data.taxAmount,
  );
  if (totals.totalAmount.lessThan(0)) return validationError("Invoice total cannot be negative.");

  const existing = id
    ? await prisma.invoice.findFirst({ where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } })
    : null;
  const branchId = shipment?.branchId ?? quotation?.branchId ?? existing?.branchId ?? defaultBranchId;
  if (!branchId) return validationError("Assign an active default branch before creating an invoice.");
  if (id && !existing) return validationError("Invoice was not found.");
  if (await lockedFinanceShipmentId(parsed.data.shipmentJobId ?? existing?.shipmentJobId, companyId)) {
    return validationError("Finance is locked for this shipment.");
  }
  if (existing && ["PAID", "CANCELLED"].includes(existing.status)) {
    return validationError("Paid or cancelled invoices cannot be edited.");
  }
  if (existing && totals.totalAmount.lessThan(existing.paidAmount)) {
    return validationError("Invoice total cannot be lower than the amount already paid.");
  }

  const saveAttempt = async () =>
    prisma.$transaction(async (tx) => {
      const invoiceNo = existing?.invoiceNo ?? (await nextNumber(tx, companyId, "invoice"));
      const paidAmount = existing?.paidAmount ?? new Prisma.Decimal(0);
      const dueAmount = totals.totalAmount.sub(paidAmount).toDecimalPlaces(2);
      const status = existing
        ? invoicePaymentStatus(paidAmount, totals.totalAmount, existing.status, parsed.data.dueDate)
        : "DRAFT";
      const data = {
        branchId,
        customerId: parsed.data.customerId,
        shipmentJobId: parsed.data.shipmentJobId ?? null,
        quotationId: parsed.data.quotationId ?? null,
        invoiceDate: parsed.data.invoiceDate,
        dueDate: parsed.data.dueDate ?? null,
        currency: parsed.data.currency,
        exchangeRateToBDT: parsed.data.exchangeRateToBDT,
        discountAmount: parsed.data.discountAmount,
        taxAmount: parsed.data.taxAmount,
        remarks: parsed.data.remarks ?? null,
        subtotal: totals.subtotal,
        totalAmount: totals.totalAmount,
        paidAmount,
        dueAmount,
        status,
      };
      const invoice = existing
        ? await tx.invoice.update({ where: { id: existing.id }, data: { ...data, updatedAt: new Date() } })
        : await tx.invoice.create({
            data: { id: crypto.randomUUID(), ...data, updatedAt: new Date(), companyId, invoiceNo, createdById: user.id },
          });
      if (existing) {
        await tx.invoiceline.deleteMany({ where: { invoiceId: invoice.id } });
      }
      await tx.invoiceline.createMany({
        data: lineResult.lines.map((line, index) => ({
          id: crypto.randomUUID(),
          companyId,
          invoiceId: invoice.id,
          description: line.description,
          chargeType: line.chargeType ?? null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: amounts[index],
          updatedAt: new Date(),
        })),
      });
      return invoice;
    });

  let invoice;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      invoice = await saveAttempt();
      break;
    } catch (error) {
      if (!isUniqueError(error) || attempt === 3) throw error;
    }
  }
  if (!invoice) return validationError("Could not reserve an invoice number.");
  await audit({
    companyId,
    actorId: user.id,
    action: existing ? "INVOICE_UPDATED" : "INVOICE_CREATED",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { invoiceNo: invoice.invoiceNo, shipmentJobId: invoice.shipmentJobId },
  });
  if (!existing) {
    await notifySafely(() =>
      dispatchNotificationEvent({
        eventKey: "invoice_created",
        companyId,
        branchId: invoice.branchId,
        entityId: invoice.id,
        internalRecipientUserId: user.id,
        variables: {
          invoiceNo: invoice.invoiceNo,
          customerName: customer.name,
          totalAmount: invoice.totalAmount.toFixed(2),
          currency: invoice.currency,
        },
        internalLinkUrl: `/dashboard/invoices/${invoice.id}`,
      }),
    );
  }
  if (invoice.shipmentJobId) {
    await recalculateShipmentWorkflow(invoice.shipmentJobId);
  }
  revalidateBilling();
  return successState(existing ? "Invoice updated." : `Invoice ${invoice.invoiceNo} created.`);
}

export async function updateInvoiceStatus(formData: FormData) {
  const target = getString(formData, "status");
  const permission = target === "SENT" ? "invoices:send" : "invoices:update";
  const { user, companyId, moduleError, accessibleBranchIds } = await requireBilling(permission);
  if (moduleError) return;
  const invoice = await prisma.invoice.findFirst({
    where: { id: getString(formData, "id"), companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
  });
  if (!invoice || invoice.status === "PAID") return;
  if (!["SENT", "CANCELLED"].includes(target)) return;
  const updated = await prisma.$transaction((tx) =>
    tx.invoice.update({
      where: { id: invoice.id },
      data:
        target === "SENT"
          ? { status: "SENT", sentAt: new Date() }
          : { status: "CANCELLED", cancelledAt: new Date() },
    }),
  );
  await audit({
    companyId,
    actorId: user.id,
    action: target === "SENT" ? "INVOICE_SENT" : "INVOICE_CANCELLED",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { invoiceNo: invoice.invoiceNo, from: invoice.status, to: updated.status, shipmentJobId: invoice.shipmentJobId },
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "INVOICE_STATUS_CHANGED",
    entityType: "Invoice",
    entityId: invoice.id,
    metadata: { invoiceNo: invoice.invoiceNo, from: invoice.status, to: updated.status },
  });
  if (target === "SENT") {
    await notifySafely(async () => {
      const customer = await prisma.customer.findFirst({
        where: { id: invoice.customerId, companyId, deletedAt: null },
        select: { id: true, name: true },
      });
      if (!customer) return;
      const portalRecipientAccountId = await resolveActivePortalAccountId({ customerId: customer.id, companyId });
      const portalLinkUrl = await resolvePortalLinkUrl({ companyId, path: `/invoices/${invoice.id}` });
      await dispatchNotificationEvent({
        eventKey: "invoice_sent",
        companyId,
        branchId: invoice.branchId,
        entityId: invoice.id,
        internalRecipientUserId: invoice.createdById,
        portalRecipientAccountId,
        variables: {
          invoiceNo: invoice.invoiceNo,
          customerName: customer.name,
          dueAmount: updated.dueAmount.toFixed(2),
          dueDate: updated.dueDate ? updated.dueDate.toISOString().slice(0, 10) : "",
        },
        internalLinkUrl: `/dashboard/invoices/${invoice.id}`,
        portalLinkUrl,
      });
    });
  }
  if (invoice.shipmentJobId) {
    await recalculateShipmentWorkflow(invoice.shipmentJobId);
  }
  revalidateBilling();
}

export async function deleteInvoice(formData: FormData) {
  const { user, companyId, moduleError, accessibleBranchIds } = await requireBilling("invoices:delete");
  if (moduleError) return;
  const invoice = await prisma.invoice.findFirst({
    where: { id: getString(formData, "id"), companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
  });
  if (!invoice || invoice.paidAmount.greaterThan(0)) return;
  if (await lockedFinanceShipmentId(invoice.shipmentJobId, companyId)) return;
  await prisma.$transaction((tx) =>
    tx.invoice.update({ where: { id: invoice.id }, data: { deletedAt: new Date() } }),
  );
  await audit({ companyId, actorId: user.id, action: "INVOICE_DELETED", entityType: "Invoice", entityId: invoice.id, metadata: { invoiceNo: invoice.invoiceNo, shipmentJobId: invoice.shipmentJobId } });
  if (invoice.shipmentJobId) {
    await recalculateShipmentWorkflow(invoice.shipmentJobId);
  }
  revalidateBilling();
}

export async function saveVendorBill(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const { user, companyId, moduleError } = await requireBilling(
    id ? "vendorBills:update" : "vendorBills:create",
  );
  if (moduleError) return validationError(moduleError);
  const { defaultBranchId, accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const parsed = vendorBillHeaderSchema.safeParse({
    id,
    vendorId: getString(formData, "vendorId"),
    shipmentJobId: getString(formData, "shipmentJobId"),
    billDate: getString(formData, "billDate"),
    dueDate: getString(formData, "dueDate"),
    currency: getString(formData, "currency") || "BDT",
    exchangeRateToBDT: getString(formData, "exchangeRateToBDT") || "1",
    discountAmount: getString(formData, "discountAmount") || "0",
    taxAmount: getString(formData, "taxAmount") || "0",
    remarks: getString(formData, "remarks"),
  });
  if (!parsed.success) {
    return validationError("Please fix the vendor bill fields.", parsed.error.flatten().fieldErrors);
  }
  const lineResult = parseLines(formData);
  if (!lineResult.lines) return validationError(lineResult.error ?? "Add bill lines.");
  const [vendor, shipment] = await Promise.all([
    prisma.vendor.findFirst({ where: { id: parsed.data.vendorId, companyId, deletedAt: null } }),
    parsed.data.shipmentJobId
      ? prisma.shipmentjob.findFirst({ where: { id: parsed.data.shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } })
      : null,
  ]);
  if (!vendor) return validationError("Select a valid vendor from this company.");
  if (parsed.data.shipmentJobId && !shipment) return validationError("Select a valid shipment from this company.");
  const amounts = lineResult.lines.map((line) => calculateLineAmount(line.quantity, line.unitPrice));
  const totals = calculateDocumentTotals(amounts, parsed.data.discountAmount, parsed.data.taxAmount);
  if (totals.totalAmount.lessThan(0)) return validationError("Vendor bill total cannot be negative.");
  const existing = id
    ? await prisma.vendorbill.findFirst({ where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } })
    : null;
  const branchId = shipment?.branchId ?? existing?.branchId ?? defaultBranchId;
  if (!branchId) return validationError("Assign an active default branch before creating a vendor bill.");
  if (id && !existing) return validationError("Vendor bill was not found.");
  if (await lockedFinanceShipmentId(parsed.data.shipmentJobId ?? existing?.shipmentJobId, companyId)) {
    return validationError("Finance is locked for this shipment.");
  }
  if (existing && ["PAID", "CANCELLED"].includes(existing.status)) {
    return validationError("Paid or cancelled vendor bills cannot be edited.");
  }
  if (existing && totals.totalAmount.lessThan(existing.paidAmount)) {
    return validationError("Bill total cannot be lower than the amount already paid.");
  }

  const saveAttempt = async () =>
    prisma.$transaction(async (tx) => {
      const billNo = existing?.billNo ?? (await nextNumber(tx, companyId, "vendorBill"));
      const paidAmount = existing?.paidAmount ?? new Prisma.Decimal(0);
      const dueAmount = totals.totalAmount.sub(paidAmount).toDecimalPlaces(2);
      const status = existing
        ? vendorBillPaymentStatus(paidAmount, totals.totalAmount, existing.status, parsed.data.dueDate)
        : "DRAFT";
      const data = {
        branchId,
        vendorId: parsed.data.vendorId,
        shipmentJobId: parsed.data.shipmentJobId ?? null,
        billDate: parsed.data.billDate,
        dueDate: parsed.data.dueDate ?? null,
        currency: parsed.data.currency,
        exchangeRateToBDT: parsed.data.exchangeRateToBDT,
        discountAmount: parsed.data.discountAmount,
        taxAmount: parsed.data.taxAmount,
        remarks: parsed.data.remarks ?? null,
        subtotal: totals.subtotal,
        totalAmount: totals.totalAmount,
        paidAmount,
        dueAmount,
        status,
      };
      const bill = existing
        ? await tx.vendorbill.update({ where: { id: existing.id }, data: { ...data, updatedAt: new Date() } })
        : await tx.vendorbill.create({ data: { id: crypto.randomUUID(), ...data, updatedAt: new Date(), companyId, billNo, createdById: user.id } });
      // Material edit (amount change) invalidates an in-flight approval --
      // the approver would otherwise be deciding on stale numbers. The bill
      // stays editable; a fresh "Mark received" submits a brand new request.
      if (existing && !totals.totalAmount.equals(existing.totalAmount)) {
        await tx.approvalrequest.updateMany({
          where: { vendorBillId: bill.id, status: "PENDING" },
          data: { status: "CANCELLED", decidedAt: new Date() },
        });
      }
      if (existing) await tx.vendorbillline.deleteMany({ where: { vendorBillId: bill.id } });
      await tx.vendorbillline.createMany({
        data: lineResult.lines.map((line, index) => ({
          id: crypto.randomUUID(),
          companyId,
          vendorBillId: bill.id,
          description: line.description,
          chargeType: line.chargeType ?? null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: amounts[index],
          remarks: line.remarks ?? null,
          updatedAt: new Date(),
        })),
      });
      return bill;
    });
  let bill;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      bill = await saveAttempt();
      break;
    } catch (error) {
      if (!isUniqueError(error) || attempt === 3) throw error;
    }
  }
  if (!bill) return validationError("Could not reserve a vendor bill number.");
  await audit({ companyId, actorId: user.id, action: existing ? "VENDOR_BILL_UPDATED" : "VENDOR_BILL_CREATED", entityType: "VendorBill", entityId: bill.id, metadata: { billNo: bill.billNo, shipmentJobId: bill.shipmentJobId } });
  if (!existing) {
    await notifySafely(() =>
      dispatchNotificationEvent({
        eventKey: "vendor_bill_created",
        companyId,
        branchId: bill.branchId,
        entityId: bill.id,
        internalRecipientUserId: user.id,
        variables: {
          billNo: bill.billNo,
          vendorName: vendor.name,
          totalAmount: bill.totalAmount.toFixed(2),
          currency: bill.currency,
        },
        internalLinkUrl: `/dashboard/vendor-bills/${bill.id}`,
      }),
    );
  }
  if (bill.shipmentJobId) {
    await recalculateShipmentWorkflow(bill.shipmentJobId);
  }
  revalidateBilling();
  return successState(existing ? "Vendor bill updated." : `Vendor bill ${bill.billNo} created.`);
}

export async function updateVendorBillStatus(formData: FormData) {
  const { user, companyId, moduleError, accessibleBranchIds } = await requireBilling("vendorBills:update");
  if (moduleError) return;
  const target = getString(formData, "status");
  const bill = await prisma.vendorbill.findFirst({ where: { id: getString(formData, "id"), companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } });
  if (!bill || bill.status === "PAID" || !["RECEIVED", "CANCELLED"].includes(target)) return;

  if (target === "RECEIVED") {
    const amountBDT = toBdt(bill.totalAmount, bill.exchangeRateToBDT);
    const policy = await resolveApplicablePolicy(companyId, "VENDOR_BILL", bill.branchId);
    if (policyRequiresApproval(policy, amountBDT)) {
      const alreadyPending = await prisma.approvalrequest.findFirst({ where: { vendorBillId: bill.id, status: "PENDING" } });
      if (alreadyPending) return;
      const request = await prisma.$transaction((tx) =>
        submitApprovalRequestTx(tx, {
          companyId,
          branchId: bill.branchId,
          policy: policy!,
          documentType: "VENDOR_BILL",
          vendorBillId: bill.id,
          amountBDT,
          submittedById: user.id,
        }),
      );
      await audit({
        companyId,
        actorId: user.id,
        action: "VENDOR_BILL_APPROVAL_SUBMITTED",
        entityType: "VendorBill",
        entityId: bill.id,
        metadata: { billNo: bill.billNo, amountBDT: amountBDT.toFixed(2) },
      });
      await notifySafely(() =>
        notifyApprovalRequested({
          companyId,
          branchId: bill.branchId,
          requestId: request.id,
          documentLabel: "Vendor bill",
          documentNo: bill.billNo,
          amountBDT,
        }),
      );
      revalidateBilling();
      return;
    }
  }

  const updated = await prisma.$transaction((tx) =>
    tx.vendorbill.update({
      where: { id: bill.id },
      data: target === "RECEIVED" ? { status: "RECEIVED", receivedAt: new Date() } : { status: "CANCELLED", cancelledAt: new Date() },
    }),
  );
  await audit({ companyId, actorId: user.id, action: target === "RECEIVED" ? "VENDOR_BILL_RECEIVED" : "VENDOR_BILL_CANCELLED", entityType: "VendorBill", entityId: bill.id, metadata: { billNo: bill.billNo, from: bill.status, to: updated.status, shipmentJobId: bill.shipmentJobId } });
  await audit({ companyId, actorId: user.id, action: "VENDOR_BILL_STATUS_CHANGED", entityType: "VendorBill", entityId: bill.id, metadata: { billNo: bill.billNo, from: bill.status, to: updated.status } });
  if (target === "RECEIVED") {
    await notifySafely(() =>
      dispatchNotificationEvent({
        eventKey: "vendor_bill_received",
        companyId,
        branchId: bill.branchId,
        entityId: bill.id,
        internalRecipientUserId: bill.createdById,
        variables: { billNo: bill.billNo },
        internalLinkUrl: `/dashboard/vendor-bills/${bill.id}`,
      }),
    );
  }
  if (bill.shipmentJobId) {
    await recalculateShipmentWorkflow(bill.shipmentJobId);
  }
  revalidateBilling();
}

export async function deleteVendorBill(formData: FormData) {
  const { user, companyId, moduleError, accessibleBranchIds } = await requireBilling("vendorBills:delete");
  if (moduleError) return;
  const bill = await prisma.vendorbill.findFirst({ where: { id: getString(formData, "id"), companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } });
  if (!bill || bill.paidAmount.greaterThan(0)) return;
  if (await lockedFinanceShipmentId(bill.shipmentJobId, companyId)) return;
  await prisma.$transaction((tx) =>
    tx.vendorbill.update({ where: { id: bill.id }, data: { deletedAt: new Date() } }),
  );
  await audit({ companyId, actorId: user.id, action: "VENDOR_BILL_DELETED", entityType: "VendorBill", entityId: bill.id, metadata: { billNo: bill.billNo, shipmentJobId: bill.shipmentJobId } });
  if (bill.shipmentJobId) {
    await recalculateShipmentWorkflow(bill.shipmentJobId);
  }
  revalidateBilling();
}

/**
 * Applies a payment's real financial effect (paidAmount/dueAmount/status on
 * the linked invoice or vendor bill). Shared by the immediate-clear path
 * (payment created below threshold, or no policy configured) and the
 * post-approval path (`applyApprovedPayment`) -- the computation itself is
 * unchanged from before Phase 09, only moved into its own function so both
 * callers run the exact same logic.
 */
async function applyPaymentFinancialEffectTx(
  tx: Prisma.TransactionClient,
  {
    paymentId,
    amount,
    currentInvoice,
    currentBill,
    companyId,
    actorId,
  }: {
    paymentId: string;
    amount: Prisma.Decimal;
    currentInvoice: { id: string; invoiceNo: string; paidAmount: Prisma.Decimal; totalAmount: Prisma.Decimal; status: string; dueDate: Date | null } | null;
    currentBill: { id: string; billNo: string; paidAmount: Prisma.Decimal; totalAmount: Prisma.Decimal; status: string; dueDate: Date | null } | null;
    companyId: string;
    actorId: string;
  },
) {
  if (currentInvoice) {
    const paidAmount = currentInvoice.paidAmount.add(amount).toDecimalPlaces(2);
    const dueAmount = currentInvoice.totalAmount.sub(paidAmount).toDecimalPlaces(2);
    const status = invoicePaymentStatus(
      paidAmount,
      currentInvoice.totalAmount,
      currentInvoice.status as never,
      currentInvoice.dueDate,
    );
    await tx.invoice.update({
      where: { id: currentInvoice.id },
      data: { paidAmount, dueAmount, status },
    });
    if (status !== currentInvoice.status) {
      await tx.auditlog.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          actorId,
          action: "INVOICE_STATUS_CHANGED",
          entityType: "Invoice",
          entityId: currentInvoice.id,
          metadata: JSON.stringify({
            invoiceNo: currentInvoice.invoiceNo,
            from: currentInvoice.status,
            to: status,
            paymentId,
          }),
        },
      });
    }
  }
  if (currentBill) {
    const paidAmount = currentBill.paidAmount.add(amount).toDecimalPlaces(2);
    const dueAmount = currentBill.totalAmount.sub(paidAmount).toDecimalPlaces(2);
    const status = vendorBillPaymentStatus(
      paidAmount,
      currentBill.totalAmount,
      currentBill.status as never,
      currentBill.dueDate,
    );
    await tx.vendorbill.update({
      where: { id: currentBill.id },
      data: { paidAmount, dueAmount, status },
    });
    if (status !== currentBill.status) {
      await tx.auditlog.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          actorId,
          action: "VENDOR_BILL_STATUS_CHANGED",
          entityType: "VendorBill",
          entityId: currentBill.id,
          metadata: JSON.stringify({
            billNo: currentBill.billNo,
            from: currentBill.status,
            to: status,
            paymentId,
          }),
        },
      });
    }
  }
}

export async function createPayment(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId, moduleError } = await requireBilling("payments:create");
  if (moduleError) return validationError(moduleError);
  const { defaultBranchId, accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const parsed = paymentSchema.safeParse({
    direction: getString(formData, "direction"),
    customerId: getString(formData, "customerId"),
    vendorId: getString(formData, "vendorId"),
    invoiceId: getString(formData, "invoiceId"),
    vendorBillId: getString(formData, "vendorBillId"),
    shipmentJobId: getString(formData, "shipmentJobId"),
    paymentDate: getString(formData, "paymentDate"),
    paymentMethod: getString(formData, "paymentMethod"),
    referenceNo: getString(formData, "referenceNo"),
    currency: getString(formData, "currency") || "BDT",
    exchangeRateToBDT: getString(formData, "exchangeRateToBDT") || "1",
    amount: getString(formData, "amount"),
    remarks: getString(formData, "remarks"),
  });
  if (!parsed.success) {
    return validationError("Please fix the payment fields.", parsed.error.flatten().fieldErrors);
  }
  if (parsed.data.direction === "RECEIVED" && !parsed.data.customerId) {
    return validationError("Customer is required for a received payment.");
  }
  if (parsed.data.direction === "PAID" && !parsed.data.vendorId) {
    return validationError("Vendor is required for a paid payment.");
  }
  const [customer, vendor, shipment, invoice, bill] = await Promise.all([
    parsed.data.customerId ? prisma.customer.findFirst({ where: { id: parsed.data.customerId, companyId, deletedAt: null } }) : null,
    parsed.data.vendorId ? prisma.vendor.findFirst({ where: { id: parsed.data.vendorId, companyId, deletedAt: null } }) : null,
    parsed.data.shipmentJobId ? prisma.shipmentjob.findFirst({ where: { id: parsed.data.shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } }) : null,
    parsed.data.invoiceId ? prisma.invoice.findFirst({ where: { id: parsed.data.invoiceId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } }) : null,
    parsed.data.vendorBillId ? prisma.vendorbill.findFirst({ where: { id: parsed.data.vendorBillId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } }) : null,
  ]);
  if (parsed.data.customerId && !customer) return validationError("Select a valid customer from this company.");
  if (parsed.data.vendorId && !vendor) return validationError("Select a valid vendor from this company.");
  if (parsed.data.shipmentJobId && !shipment) return validationError("Select a valid shipment from this company.");
  if (parsed.data.invoiceId && (!invoice || invoice.customerId !== customer?.id)) return validationError("Select a valid invoice for this customer.");
  if (parsed.data.vendorBillId && (!bill || bill.vendorId !== vendor?.id)) return validationError("Select a valid vendor bill for this vendor.");
  if (parsed.data.direction === "RECEIVED" && (bill || parsed.data.vendorBillId)) return validationError("Received payments cannot be linked to vendor bills.");
  if (parsed.data.direction === "PAID" && (invoice || parsed.data.invoiceId)) return validationError("Paid payments cannot be linked to customer invoices.");
  if (invoice && invoice.status === "CANCELLED") return validationError("Cancelled invoices cannot accept payment.");
  if (bill && bill.status === "CANCELLED") return validationError("Cancelled vendor bills cannot accept payment.");
  const amount = new Prisma.Decimal(parsed.data.amount);
  if (invoice && amount.greaterThan(invoice.dueAmount)) return validationError("Payment cannot exceed invoice due amount.");
  if (bill && amount.greaterThan(bill.dueAmount)) return validationError("Payment cannot exceed vendor bill due amount.");

  const amountInBDT = amount.mul(parsed.data.exchangeRateToBDT).toDecimalPlaces(2);
  const branchId = shipment?.branchId ?? invoice?.branchId ?? bill?.branchId ?? defaultBranchId;
  if (!branchId) return validationError("Assign an active default branch before recording a payment.");

  const paymentPolicy = await resolveApplicablePolicy(companyId, "PAYMENT", branchId);
  const needsApproval = policyRequiresApproval(paymentPolicy, amountInBDT);

  const saveAttempt = async () =>
    prisma.$transaction(async (tx) => {
      const currentInvoice = parsed.data.invoiceId
        ? await tx.invoice.findFirst({
            where: { id: parsed.data.invoiceId, companyId, deletedAt: null },
          })
        : null;
      const currentBill = parsed.data.vendorBillId
        ? await tx.vendorbill.findFirst({
            where: { id: parsed.data.vendorBillId, companyId, deletedAt: null },
          })
        : null;
      if (parsed.data.invoiceId && (!currentInvoice || currentInvoice.customerId !== parsed.data.customerId)) {
        throw new BillingValidationError("The selected invoice is no longer available for this customer.");
      }
      if (parsed.data.vendorBillId && (!currentBill || currentBill.vendorId !== parsed.data.vendorId)) {
        throw new BillingValidationError("The selected vendor bill is no longer available for this vendor.");
      }
      if (currentInvoice && (currentInvoice.status === "CANCELLED" || amount.greaterThan(currentInvoice.dueAmount))) {
        throw new BillingValidationError("Payment cannot exceed the current invoice due amount.");
      }
      if (currentBill && (currentBill.status === "CANCELLED" || amount.greaterThan(currentBill.dueAmount))) {
        throw new BillingValidationError("Payment cannot exceed the current vendor bill due amount.");
      }
      const paymentNo = await nextNumber(tx, companyId, "payment");
      const payment = await tx.payment.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          branchId,
          paymentNo,
          direction: parsed.data.direction,
          status: needsApproval ? "PENDING" : "CLEARED",
          customerId: parsed.data.customerId ?? null,
          vendorId: parsed.data.vendorId ?? null,
          invoiceId: parsed.data.invoiceId ?? null,
          vendorBillId: parsed.data.vendorBillId ?? null,
          shipmentJobId: parsed.data.shipmentJobId ?? currentInvoice?.shipmentJobId ?? currentBill?.shipmentJobId ?? null,
          paymentDate: parsed.data.paymentDate,
          paymentMethod: parsed.data.paymentMethod,
          referenceNo: parsed.data.referenceNo ?? null,
          currency: parsed.data.currency,
          exchangeRateToBDT: parsed.data.exchangeRateToBDT,
          amount,
          amountInBDT,
          remarks: parsed.data.remarks ?? null,
          createdById: user.id,
          updatedAt: new Date(),
        },
      });
      if (needsApproval) {
        await submitApprovalRequestTx(tx, {
          companyId,
          branchId,
          policy: paymentPolicy!,
          documentType: "PAYMENT",
          paymentId: payment.id,
          amountBDT: amountInBDT,
          submittedById: user.id,
        });
      } else {
        await applyPaymentFinancialEffectTx(tx, {
          paymentId: payment.id,
          amount,
          currentInvoice,
          currentBill,
          companyId,
          actorId: user.id,
        });
      }
      return payment;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  let payment;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      payment = await saveAttempt();
      break;
    } catch (error) {
      if (error instanceof BillingValidationError) return validationError(error.message);
      if (!isUniqueError(error) || attempt === 3) throw error;
    }
  }
  if (!payment) return validationError("Could not reserve a payment number.");

  if (needsApproval) {
    await audit({
      companyId,
      actorId: user.id,
      action: "PAYMENT_SUBMITTED_FOR_APPROVAL",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { paymentNo: payment.paymentNo, invoiceId: payment.invoiceId, vendorBillId: payment.vendorBillId, amountBDT: amountInBDT.toFixed(2) },
    });
    await notifySafely(async () => {
      const request = await prisma.approvalrequest.findFirst({ where: { paymentId: payment.id } });
      if (!request) return;
      await notifyApprovalRequested({
        companyId,
        branchId,
        requestId: request.id,
        documentLabel: "Payment",
        documentNo: payment.paymentNo,
        amountBDT: amountInBDT,
      });
    });
    revalidateBilling();
    return successState(`Payment ${payment.paymentNo} submitted for approval.`);
  }

  await audit({
    companyId,
    actorId: user.id,
    action: payment.direction === "RECEIVED" ? "PAYMENT_RECEIVED_CREATED" : "PAYMENT_PAID_CREATED",
    entityType: "Payment",
    entityId: payment.id,
    metadata: { paymentNo: payment.paymentNo, invoiceId: payment.invoiceId, vendorBillId: payment.vendorBillId, shipmentJobId: payment.shipmentJobId },
  });
  await notifySafely(async () => {
    await dispatchNotificationEvent({
      eventKey: "payment_received",
      companyId,
      branchId: payment.branchId,
      entityId: payment.id,
      internalRecipientUserId: payment.createdById,
      variables: {
        paymentNo: payment.paymentNo,
        amount: payment.amount.toFixed(2),
        currency: payment.currency,
      },
      internalLinkUrl: payment.direction === "RECEIVED" ? "/dashboard/payments/received" : "/dashboard/payments/paid",
    });

    // Re-fetch post-transaction state instead of restructuring saveAttempt()'s
    // return value -- this keeps the payment transaction (single caller) untouched.
    if (payment.invoiceId && invoice && invoice.status !== "PAID") {
      const currentInvoice = await prisma.invoice.findFirst({ where: { id: payment.invoiceId, companyId, deletedAt: null } });
      if (currentInvoice?.status === "PAID") {
        await dispatchNotificationEvent({
          eventKey: "invoice_paid",
          companyId,
          branchId: currentInvoice.branchId,
          entityId: currentInvoice.id,
          internalRecipientUserId: currentInvoice.createdById,
          variables: { invoiceNo: currentInvoice.invoiceNo, paidAmount: currentInvoice.paidAmount.toFixed(2), currency: currentInvoice.currency },
          internalLinkUrl: `/dashboard/invoices/${currentInvoice.id}`,
        });
      }
    }
    if (payment.vendorBillId && bill && bill.status !== "PAID") {
      const currentBill = await prisma.vendorbill.findFirst({ where: { id: payment.vendorBillId, companyId, deletedAt: null } });
      if (currentBill?.status === "PAID") {
        await dispatchNotificationEvent({
          eventKey: "vendor_bill_paid",
          companyId,
          branchId: currentBill.branchId,
          entityId: currentBill.id,
          internalRecipientUserId: currentBill.createdById,
          variables: { billNo: currentBill.billNo, paidAmount: currentBill.paidAmount.toFixed(2), currency: currentBill.currency },
          internalLinkUrl: `/dashboard/vendor-bills/${currentBill.id}`,
        });
      }
    }
  });
  if (payment.shipmentJobId) {
    await recalculateShipmentWorkflow(payment.shipmentJobId);
  }
  revalidateBilling();
  return successState(`Payment ${payment.paymentNo} recorded.`);
}

export async function updatePayment(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId, moduleError, accessibleBranchIds } = await requireBilling("payments:update");
  if (moduleError) return validationError(moduleError);
  const parsed = paymentUpdateSchema.safeParse({
    id: getString(formData, "id"),
    paymentDate: getString(formData, "paymentDate"),
    paymentMethod: getString(formData, "paymentMethod"),
    referenceNo: getString(formData, "referenceNo"),
    remarks: getString(formData, "remarks"),
  });
  if (!parsed.success) {
    return validationError("Please fix the payment fields.", parsed.error.flatten().fieldErrors);
  }
  const payment = await prisma.payment.findFirst({
    where: { id: parsed.data.id, companyId, deletedAt: null, status: "CLEARED", ...branchScopeWhere(accessibleBranchIds) },
  });
  if (!payment) return validationError("Payment was not found.");
  const updated = await prisma.$transaction((tx) =>
    tx.payment.update({
      where: { id: payment.id },
      data: {
        paymentDate: parsed.data.paymentDate,
        paymentMethod: parsed.data.paymentMethod,
        referenceNo: parsed.data.referenceNo ?? null,
        remarks: parsed.data.remarks ?? null,
      },
    }),
  );
  await audit({
    companyId,
    actorId: user.id,
    action: "PAYMENT_UPDATED",
    entityType: "Payment",
    entityId: updated.id,
    metadata: { paymentNo: updated.paymentNo, shipmentJobId: updated.shipmentJobId },
  });
  revalidateBilling();
  return successState(`Payment ${updated.paymentNo} updated.`);
}

export async function deletePayment(formData: FormData) {
  const { user, companyId, moduleError, accessibleBranchIds } = await requireBilling("payments:delete");
  if (moduleError) return;
  const payment = await prisma.payment.findFirst({
    where: { id: getString(formData, "id"), companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: { invoice: true, vendorbill: true },
  });
  if (!payment || payment.status !== "CLEARED") return;
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { deletedAt: new Date(), status: "CANCELLED" } });
    if (payment.invoice) {
      const paidAmount = payment.invoice.paidAmount.sub(payment.amount).toDecimalPlaces(2);
      const status = invoicePaymentStatus(
        paidAmount,
        payment.invoice.totalAmount,
        payment.invoice.status,
        payment.invoice.dueDate,
      );
      await tx.invoice.update({
        where: { id: payment.invoice.id },
        data: {
          paidAmount,
          dueAmount: payment.invoice.totalAmount.sub(paidAmount).toDecimalPlaces(2),
          status,
        },
      });
      if (status !== payment.invoice.status) {
        await tx.auditlog.create({
          data: {
            id: crypto.randomUUID(),
            companyId,
            actorId: user.id,
            action: "INVOICE_STATUS_CHANGED",
            entityType: "Invoice",
            entityId: payment.invoice.id,
            metadata: JSON.stringify({
              invoiceNo: payment.invoice.invoiceNo,
              from: payment.invoice.status,
              to: status,
              paymentId: payment.id,
              reversal: true,
            }),
          },
        });
      }
    }
    if (payment.vendorbill) {
      const paidAmount = payment.vendorbill.paidAmount.sub(payment.amount).toDecimalPlaces(2);
      const status = vendorBillPaymentStatus(
        paidAmount,
        payment.vendorbill.totalAmount,
        payment.vendorbill.status,
        payment.vendorbill.dueDate,
      );
      await tx.vendorbill.update({
        where: { id: payment.vendorbill.id },
        data: {
          paidAmount,
          dueAmount: payment.vendorbill.totalAmount.sub(paidAmount).toDecimalPlaces(2),
          status,
        },
      });
      if (status !== payment.vendorbill.status) {
        await tx.auditlog.create({
          data: {
            id: crypto.randomUUID(),
            companyId,
            actorId: user.id,
            action: "VENDOR_BILL_STATUS_CHANGED",
            entityType: "VendorBill",
            entityId: payment.vendorbill.id,
            metadata: JSON.stringify({
              billNo: payment.vendorbill.billNo,
              from: payment.vendorbill.status,
              to: status,
              paymentId: payment.id,
              reversal: true,
            }),
          },
        });
      }
    }
  });
  await audit({ companyId, actorId: user.id, action: "PAYMENT_DELETED", entityType: "Payment", entityId: payment.id, metadata: { paymentNo: payment.paymentNo, shipmentJobId: payment.shipmentJobId } });
  if (payment.shipmentJobId) {
    await recalculateShipmentWorkflow(payment.shipmentJobId);
  }
  revalidateBilling();
}

/**
 * Phase 09: called from `lib/actions/approvals.ts` once an ApprovalRequest
 * for a vendor bill reaches full approval. Applies the exact same
 * status/receivedAt transition and notification that a direct "Mark
 * received" click applies in `updateVendorBillStatus` -- this is the only
 * other writer of that transition.
 */
export async function applyApprovedVendorBillReceipt(vendorBillId: string, companyId: string, actorId: string) {
  const bill = await prisma.vendorbill.findFirst({ where: { id: vendorBillId, companyId, deletedAt: null } });
  if (!bill || bill.status !== "DRAFT") return;
  const updated = await prisma.$transaction((tx) =>
    tx.vendorbill.update({ where: { id: bill.id }, data: { status: "RECEIVED", receivedAt: new Date() } }),
  );
  await audit({
    companyId,
    actorId,
    action: "VENDOR_BILL_RECEIVED",
    entityType: "VendorBill",
    entityId: bill.id,
    metadata: { billNo: bill.billNo, from: bill.status, to: updated.status, viaApproval: true },
  });
  await notifySafely(() =>
    dispatchNotificationEvent({
      eventKey: "vendor_bill_received",
      companyId,
      branchId: bill.branchId,
      entityId: bill.id,
      internalRecipientUserId: bill.createdById,
      variables: { billNo: bill.billNo },
      internalLinkUrl: `/dashboard/vendor-bills/${bill.id}`,
    }),
  );
  if (bill.shipmentJobId) {
    await recalculateShipmentWorkflow(bill.shipmentJobId);
  }
  revalidateBilling();
}

/**
 * Phase 09: called once an ApprovalRequest for a payment reaches full
 * approval. Re-fetches the PENDING payment and its linked invoice/vendor
 * bill fresh inside its own Serializable transaction, applies the exact same
 * `applyPaymentFinancialEffectTx` used by the below-threshold immediate path
 * in `createPayment`, and flips the payment to CLEARED.
 */
export async function applyApprovedPayment(paymentId: string, companyId: string, actorId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, companyId, deletedAt: null } });
    if (!payment || payment.status !== "PENDING") return { outcome: "skipped" as const };

    const currentInvoice = payment.invoiceId
      ? await tx.invoice.findFirst({ where: { id: payment.invoiceId, companyId, deletedAt: null } })
      : null;
    const currentBill = payment.vendorBillId
      ? await tx.vendorbill.findFirst({ where: { id: payment.vendorBillId, companyId, deletedAt: null } })
      : null;

    // The bill/invoice may have received other payments while this one sat
    // PENDING for approval -- re-validate against the CURRENT due amount
    // right before applying, exactly like the immediate (below-threshold)
    // path already does at creation time. Never let an approval silently
    // push dueAmount negative.
    const staleAgainstInvoice = currentInvoice && (currentInvoice.status === "CANCELLED" || payment.amount.greaterThan(currentInvoice.dueAmount));
    const staleAgainstBill = currentBill && (currentBill.status === "CANCELLED" || payment.amount.greaterThan(currentBill.dueAmount));
    if (staleAgainstInvoice || staleAgainstBill) {
      const cancelled = await tx.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
      return { outcome: "stale" as const, payment: cancelled };
    }

    await applyPaymentFinancialEffectTx(tx, {
      paymentId: payment.id,
      amount: payment.amount,
      currentInvoice,
      currentBill,
      companyId,
      actorId,
    });
    const cleared = await tx.payment.update({ where: { id: payment.id }, data: { status: "CLEARED" } });
    return { outcome: "applied" as const, payment: cleared };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if (result.outcome === "skipped") return;

  if (result.outcome === "stale") {
    await audit({
      companyId,
      actorId,
      action: "PAYMENT_APPROVAL_CANCELLED_STALE",
      entityType: "Payment",
      entityId: result.payment.id,
      metadata: { paymentNo: result.payment.paymentNo, reason: "Due amount changed while approval was pending" },
    });
    await notifySafely(() =>
      dispatchNotificationEvent({
        eventKey: "approval_decided",
        companyId,
        branchId: result.payment.branchId,
        entityId: result.payment.id,
        internalRecipientUserId: result.payment.createdById,
        variables: {
          documentLabel: "Payment",
          documentNo: result.payment.paymentNo,
          decision: "cancelled",
          decidedByName: "the system",
          remarksSuffix: " (the linked invoice/vendor bill balance changed while this payment was awaiting approval -- please resubmit)",
        },
      }),
    );
    return;
  }

  const applied = result.payment;
  await audit({
    companyId,
    actorId,
    action: applied.direction === "RECEIVED" ? "PAYMENT_RECEIVED_CREATED" : "PAYMENT_PAID_CREATED",
    entityType: "Payment",
    entityId: applied.id,
    metadata: { paymentNo: applied.paymentNo, viaApproval: true },
  });
  await notifySafely(async () => {
    await dispatchNotificationEvent({
      eventKey: "payment_received",
      companyId,
      branchId: applied.branchId,
      entityId: applied.id,
      internalRecipientUserId: applied.createdById,
      variables: { paymentNo: applied.paymentNo, amount: applied.amount.toFixed(2), currency: applied.currency },
      internalLinkUrl: applied.direction === "RECEIVED" ? "/dashboard/payments/received" : "/dashboard/payments/paid",
    });
    if (applied.invoiceId) {
      const currentInvoice = await prisma.invoice.findFirst({ where: { id: applied.invoiceId, companyId, deletedAt: null } });
      if (currentInvoice?.status === "PAID") {
        await dispatchNotificationEvent({
          eventKey: "invoice_paid",
          companyId,
          branchId: currentInvoice.branchId,
          entityId: currentInvoice.id,
          internalRecipientUserId: currentInvoice.createdById,
          variables: { invoiceNo: currentInvoice.invoiceNo, paidAmount: currentInvoice.paidAmount.toFixed(2), currency: currentInvoice.currency },
          internalLinkUrl: `/dashboard/invoices/${currentInvoice.id}`,
        });
      }
    }
    if (applied.vendorBillId) {
      const currentBill = await prisma.vendorbill.findFirst({ where: { id: applied.vendorBillId, companyId, deletedAt: null } });
      if (currentBill?.status === "PAID") {
        await dispatchNotificationEvent({
          eventKey: "vendor_bill_paid",
          companyId,
          branchId: currentBill.branchId,
          entityId: currentBill.id,
          internalRecipientUserId: currentBill.createdById,
          variables: { billNo: currentBill.billNo, paidAmount: currentBill.paidAmount.toFixed(2), currency: currentBill.currency },
          internalLinkUrl: `/dashboard/vendor-bills/${currentBill.id}`,
        });
      }
    }
  });
  if (applied.shipmentJobId) {
    await recalculateShipmentWorkflow(applied.shipmentJobId);
  }
  revalidateBilling();
}
