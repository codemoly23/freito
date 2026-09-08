"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/lib/generated/prisma/client";
import { ensureModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getBranchWriteScope, getCurrentBranchScope, resolveWritableBranchId } from "@/lib/access/branch-access";
import { prisma } from "@/lib/db/prisma";
import {
  calculateAmounts,
  copyQuotationChargesToShipmentJob,
  recalculateQuotationTotals,
  recalculateShipmentCostTotals,
} from "@/lib/finance/calculations";
import { getDynamicChecklistForShipment } from "@/lib/documents/engine";
import {
  quotationChargeRowSchema,
  quotationChargeSchema,
  quotationSchema,
  quotationStatusSchema,
  shipmentCostSchema,
  type QuotationChargeRowInput,
} from "@/lib/validators/finance";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  revalidateAdminPaths,
  revalidateQuotationPaths,
  successState,
  validationError,
} from "@/lib/actions/helpers";

async function generateQuoteNo(tx: Prisma.TransactionClient, companyId: string) {
  const year = new Date().getFullYear();
  const existingQuotes = await tx.quotation.findMany({
    where: { companyId, quoteNo: { contains: `QT-${year}-` } },
    select: { quoteNo: true },
  });
  const existingMax = existingQuotes.reduce((max, quote) => {
    const sequence = Number(quote.quoteNo.split("-").at(-1));
    return Number.isFinite(sequence) && sequence > max ? sequence : max;
  }, 0);
  const sequence = await tx.quotationsequence.upsert({
    where: { companyId_year: { companyId, year } },
    create: { id: crypto.randomUUID(), companyId, year, currentSequence: existingMax + 1, updatedAt: new Date() },
    update: { currentSequence: { increment: 1 }, updatedAt: new Date() },
    select: { currentSequence: true },
  });

  let currentSeq = sequence.currentSequence;
  if (currentSeq <= existingMax) {
    const nextSeq = existingMax + 1;
    await tx.quotationsequence.update({
      where: { companyId_year: { companyId, year } },
      data: { currentSequence: nextSeq, updatedAt: new Date() },
    });
    currentSeq = nextSeq;
  }

  return `QT-${year}-${String(currentSeq).padStart(4, "0")}`;
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function getQuotationForAction(id: string, companyId: string | null, accessibleBranchIds?: string[] | null) {
  const scope = companyId && accessibleBranchIds === undefined ? await getCurrentBranchScope(companyId) : accessibleBranchIds ?? null;
  return prisma.quotation.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...branchScopeWhere(scope),
    },
  });
}

async function getShipmentForCosting(id: string, companyId: string | null) {
  const scope = companyId ? await getCurrentBranchScope(companyId) : null;
  return prisma.shipmentjob.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...branchScopeWhere(scope),
    },
  });
}

type FinanceSummary = {
  shipmentJobId: string;
  jobNo: string;
  financeCloseStatus: "OPEN" | "CLOSE_READY" | "LOCKED";
  quotedCustomerSellTotal: Prisma.Decimal;
  actualCustomerInvoiceTotal: Prisma.Decimal;
  customerPaidTotal: Prisma.Decimal;
  customerOutstanding: Prisma.Decimal;
  vendorBillTotal: Prisma.Decimal;
  vendorPaidTotal: Prisma.Decimal;
  vendorOutstanding: Prisma.Decimal;
  actualBuyCostTotal: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  profitMarginPercent: Prisma.Decimal;
  blockers: string[];
};

function toBdt(amount: Prisma.Decimal, exchangeRateToBDT: Prisma.Decimal) {
  return amount.mul(exchangeRateToBDT).toDecimalPlaces(2);
}

function isFinanceLocked(status: string | null | undefined) {
  return status === "LOCKED";
}

async function findLockedShipmentId(shipmentJobId: string | null | undefined, companyId: string | null) {
  if (!shipmentJobId) return null;
  const shipment = await prisma.shipmentjob.findFirst({
    where: {
      id: shipmentJobId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    },
    select: { id: true, financeCloseStatus: true },
  });
  return isFinanceLocked(shipment?.financeCloseStatus) ? shipment?.id ?? null : null;
}

async function linkedLockedQuotationShipmentId(quotation: {
  shipmentJobId?: string | null;
  convertedShipmentJobId?: string | null;
}, companyId: string | null) {
  return (
    await findLockedShipmentId(quotation.shipmentJobId, companyId) ??
    await findLockedShipmentId(quotation.convertedShipmentJobId, companyId)
  );
}

export async function calculateJobFinanceSummaryForCompany(
  shipmentJobId: string,
  companyId: string,
): Promise<FinanceSummary | null> {
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null },
    select: {
      id: true,
      jobNo: true,
      operationsStatus: true,
      closedAt: true,
      financeCloseStatus: true,
      totalBuyAmount: true,
      totalSellAmount: true,
      allowUnpaidReceivableClose: true,
      vendorPayablesNotApplicable: true,
    },
  });
  if (!shipment) return null;

  const costItemCount = await prisma.shipmentcostitem.count({
    where: { shipmentJobId, companyId, deletedAt: null },
  });
  if (costItemCount === 0) {
    const linkedQuotation = await prisma.quotation.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ shipmentJobId }, { convertedShipmentJobId: shipmentJobId }],
      },
      select: { id: true, createdById: true },
    });
    if (linkedQuotation) {
      const copied = await copyQuotationChargesToShipmentJob(
        prisma,
        linkedQuotation.id,
        shipmentJobId,
        linkedQuotation.createdById,
      );
      if (copied > 0) {
        const updatedShipment = await prisma.shipmentjob.findUnique({
          where: { id: shipmentJobId },
          select: { totalBuyAmount: true, totalSellAmount: true },
        });
        if (updatedShipment) {
          shipment.totalBuyAmount = updatedShipment.totalBuyAmount;
          shipment.totalSellAmount = updatedShipment.totalSellAmount;
        }
      }
    }
  }

  const [linkedQuotations, invoices, vendorBills] = await Promise.all([
    prisma.quotation.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ shipmentJobId }, { convertedShipmentJobId: shipmentJobId }],
      },
      select: { totalSellAmount: true },
    }),
    prisma.invoice.findMany({
      where: { companyId, shipmentJobId, deletedAt: null, status: { not: "CANCELLED" } },
      select: { totalAmount: true, paidAmount: true, dueAmount: true, exchangeRateToBDT: true },
    }),
    prisma.vendorbill.findMany({
      where: { companyId, shipmentJobId, deletedAt: null, status: { not: "CANCELLED" } },
      select: { totalAmount: true, paidAmount: true, dueAmount: true, exchangeRateToBDT: true },
    }),
  ]);

  const quotedCustomerSellTotal = linkedQuotations.length
    ? linkedQuotations.reduce(
        (sum, quotation) => sum.add(quotation.totalSellAmount),
        new Prisma.Decimal(0),
      ).toDecimalPlaces(2)
    : new Prisma.Decimal(shipment.totalSellAmount).toDecimalPlaces(2);
  const actualCustomerInvoiceTotal = invoices.reduce(
    (sum, invoice) => sum.add(toBdt(invoice.totalAmount, invoice.exchangeRateToBDT)),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2);
  const customerPaidTotal = invoices.reduce(
    (sum, invoice) => sum.add(toBdt(invoice.paidAmount, invoice.exchangeRateToBDT)),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2);
  const customerOutstanding = invoices.reduce(
    (sum, invoice) => sum.add(toBdt(invoice.dueAmount, invoice.exchangeRateToBDT)),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2);
  const vendorBillTotal = vendorBills.reduce(
    (sum, bill) => sum.add(toBdt(bill.totalAmount, bill.exchangeRateToBDT)),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2);
  const vendorPaidTotal = vendorBills.reduce(
    (sum, bill) => sum.add(toBdt(bill.paidAmount, bill.exchangeRateToBDT)),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2);
  const vendorOutstanding = vendorBills.reduce(
    (sum, bill) => sum.add(toBdt(bill.dueAmount, bill.exchangeRateToBDT)),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2);
  const actualBuyCostTotal = (vendorBills.length ? vendorBillTotal : shipment.totalBuyAmount).toDecimalPlaces(2);
  const grossProfit = actualCustomerInvoiceTotal.sub(actualBuyCostTotal).toDecimalPlaces(2);
  const profitMarginPercent = actualCustomerInvoiceTotal.isZero()
    ? new Prisma.Decimal(0)
    : grossProfit.div(actualCustomerInvoiceTotal).mul(100).toDecimalPlaces(2);

  const blockers: string[] = [];
  
  // Dynamic Document Master check for Finance Close
  const checklist = await getDynamicChecklistForShipment(shipmentJobId);
  const financeMandatory = checklist.filter(item => item.mandatoryBeforeFinanceClose);
  if (financeMandatory.length > 0) {
    const uploadedDocs = await prisma.shipmentdocument.findMany({
      where: { shipmentJobId, deletedAt: null },
    });
    for (const item of financeMandatory) {
      const hasDoc = uploadedDocs.some(
        doc => doc.documentName.toLowerCase() === item.name.toLowerCase() && doc.status !== "PENDING" && doc.status !== "REJECTED"
      );
      if (!hasDoc) {
        blockers.push(`missing_document_${item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`);
      }
    }
  }

  if (!invoices.length) blockers.push("missing_customer_invoice");
  if (customerOutstanding.greaterThan(0) && !shipment.allowUnpaidReceivableClose) {
    blockers.push("unpaid_receivable");
  }
  if (!vendorBills.length && !shipment.vendorPayablesNotApplicable) {
    blockers.push("missing_vendor_bill_decision");
  }
  if (vendorOutstanding.greaterThan(0) && !shipment.vendorPayablesNotApplicable) {
    blockers.push("unresolved_vendor_payable");
  }
  if (!shipment.closedAt && shipment.operationsStatus !== "CLOSE_READY") {
    blockers.push("job_not_operationally_close_ready");
  }

  return {
    shipmentJobId: shipment.id,
    jobNo: shipment.jobNo,
    financeCloseStatus: shipment.financeCloseStatus,
    quotedCustomerSellTotal,
    actualCustomerInvoiceTotal,
    customerPaidTotal,
    customerOutstanding,
    vendorBillTotal,
    vendorPaidTotal,
    vendorOutstanding,
    actualBuyCostTotal,
    grossProfit,
    profitMarginPercent,
    blockers,
  };
}

export async function calculateJobFinanceSummary(shipmentJobId: string) {
  const { companyId } = await getScopedCompanyId("costing:view");
  const summary = await calculateJobFinanceSummaryForCompany(shipmentJobId, companyId);
  if (!summary) return null;
  return {
    ...summary,
    quotedCustomerSellTotal: summary.quotedCustomerSellTotal.toString(),
    actualCustomerInvoiceTotal: summary.actualCustomerInvoiceTotal.toString(),
    customerPaidTotal: summary.customerPaidTotal.toString(),
    customerOutstanding: summary.customerOutstanding.toString(),
    vendorBillTotal: summary.vendorBillTotal.toString(),
    vendorPaidTotal: summary.vendorPaidTotal.toString(),
    vendorOutstanding: summary.vendorOutstanding.toString(),
    actualBuyCostTotal: summary.actualBuyCostTotal.toString(),
    grossProfit: summary.grossProfit.toString(),
    profitMarginPercent: summary.profitMarginPercent.toString(),
  };
}

function booleanFromForm(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value === "true" || value === "1" || value === "on";
}

function revalidateShipmentFinance(shipmentJobId: string) {
  revalidateAdminPaths();
  revalidatePath(`/dashboard/shipments/${shipmentJobId}`);
}

export async function updateFinanceCloseExceptionsAction(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const shipmentJobId = getString(formData, "shipmentJobId");
  const notes = getString(formData, "notes") || null;
  const allowUnpaidReceivableClose = booleanFromForm(formData, "allowUnpaidReceivableClose");
  const vendorPayablesNotApplicable = booleanFromForm(formData, "vendorPayablesNotApplicable");
  const { user, companyId } = await getScopedCompanyId("costing:update");

  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null },
    select: { id: true, jobNo: true, financeCloseStatus: true },
  });
  if (!shipment) return validationError("Shipment was not found.");
  if (isFinanceLocked(shipment.financeCloseStatus)) {
    return validationError("Finance is locked for this shipment.");
  }

  await prisma.shipmentjob.update({
    where: { id: shipment.id },
    data: {
      allowUnpaidReceivableClose,
      vendorPayablesNotApplicable,
      financeCloseNotes: notes,
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FINANCE_CLOSE_EXCEPTIONS_UPDATED",
    entityType: "ShipmentJob",
    entityId: shipment.id,
    metadata: {
      jobNo: shipment.jobNo,
      allowUnpaidReceivableClose,
      vendorPayablesNotApplicable,
    },
  });
  revalidateShipmentFinance(shipment.id);
  return successState("Finance close exceptions updated.");
}

export async function markFinanceCloseReadyAction(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const shipmentJobId = getString(formData, "shipmentJobId");
  const notes = getString(formData, "notes") || null;
  const { user, companyId } = await getScopedCompanyId("costing:update");

  const summary = await calculateJobFinanceSummaryForCompany(shipmentJobId, companyId);
  if (!summary) return validationError("Shipment was not found.");
  if (summary.financeCloseStatus === "LOCKED") {
    return validationError("Finance is already locked for this shipment.");
  }
  if (summary.blockers.length) {
    return validationError(`Finance close is blocked: ${summary.blockers.join(", ")}.`);
  }

  const now = new Date();
  await prisma.shipmentjob.update({
    where: { id: shipmentJobId },
    data: {
      financeCloseStatus: "CLOSE_READY",
      financialStatus: "FINANCE_CLOSE_READY",
      financeCloseReadyAt: now,
      financeCloseReadyById: user.id,
      financeCloseNotes: notes,
      updatedAt: now,
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FINANCE_CLOSE_READY",
    entityType: "ShipmentJob",
    entityId: shipmentJobId,
    metadata: { jobNo: summary.jobNo },
  });
  revalidateShipmentFinance(shipmentJobId);
  return successState("Finance marked close ready.");
}

export async function lockJobFinanceAction(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const shipmentJobId = getString(formData, "shipmentJobId");
  const notes = getString(formData, "notes") || null;
  const { user, companyId } = await getScopedCompanyId("costing:update");

  const summary = await calculateJobFinanceSummaryForCompany(shipmentJobId, companyId);
  if (!summary) return validationError("Shipment was not found.");
  if (summary.financeCloseStatus === "LOCKED") {
    return validationError("Finance is already locked for this shipment.");
  }
  if (summary.financeCloseStatus !== "CLOSE_READY" && summary.blockers.length) {
    return validationError(`Finance lock is blocked: ${summary.blockers.join(", ")}.`);
  }

  const now = new Date();
  await prisma.shipmentjob.update({
    where: { id: shipmentJobId },
    data: {
      financeCloseStatus: "LOCKED",
      financialStatus: "FINANCE_LOCKED",
      financeCloseReadyAt: summary.financeCloseStatus === "CLOSE_READY" ? undefined : now,
      financeCloseReadyById: summary.financeCloseStatus === "CLOSE_READY" ? undefined : user.id,
      financeLockedAt: now,
      financeLockedById: user.id,
      finalTotalSellAmount: summary.actualCustomerInvoiceTotal,
      finalTotalBuyAmount: summary.actualBuyCostTotal,
      finalGrossProfit: summary.grossProfit,
      finalProfitMarginPercent: summary.profitMarginPercent,
      financeCloseNotes: notes,
      updatedAt: now,
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FINANCE_LOCKED",
    entityType: "ShipmentJob",
    entityId: shipmentJobId,
    metadata: {
      jobNo: summary.jobNo,
      finalTotalSellAmount: summary.actualCustomerInvoiceTotal.toString(),
      finalTotalBuyAmount: summary.actualBuyCostTotal.toString(),
      finalGrossProfit: summary.grossProfit.toString(),
      finalProfitMarginPercent: summary.profitMarginPercent.toString(),
    },
  });
  revalidateShipmentFinance(shipmentJobId);
  return successState("Finance locked and profit finalized.");
}

async function validateCompanyReferences({
  companyId,
  customerId,
  shipmentJobId,
  vendorId,
  quotationId,
  accessibleBranchIds,
}: {
  companyId: string;
  customerId?: string | null;
  shipmentJobId?: string | null;
  vendorId?: string | null;
  quotationId?: string | null;
  accessibleBranchIds?: string[] | null;
}) {
  const scope =
    accessibleBranchIds === undefined ? await getCurrentBranchScope(companyId) : accessibleBranchIds ?? null;
  const [customer, shipment, vendor, quotation] = await Promise.all([
    customerId
      ? prisma.customer.findFirst({
          where: { id: customerId, companyId, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve(null),
    shipmentJobId
      ? prisma.shipmentjob.findFirst({
          where: { id: shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(scope) },
          select: { id: true },
        })
      : Promise.resolve(null),
    vendorId
      ? prisma.vendor.findFirst({
          where: { id: vendorId, companyId, deletedAt: null },
          select: { id: true },
        })
      : Promise.resolve(null),
    quotationId
      ? prisma.quotation.findFirst({
          where: { id: quotationId, companyId, deletedAt: null, ...branchScopeWhere(scope) },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (customerId && !customer) return "Select a valid customer from this company.";
  if (shipmentJobId && !shipment) return "Select a valid shipment from this company.";
  if (vendorId && !vendor) return "Select a valid vendor from this company.";
  if (quotationId && !quotation) return "Select a valid quotation from this company.";
  return null;
}

function parseQuotationCharges(formData: FormData) {
  const chargeNames = formData.getAll("chargeName").map(String);
  if (!chargeNames.length) {
    return { charges: [] as QuotationChargeRowInput[] };
  }

  const chargeIds = formData.getAll("chargeId").map(String);
  const chargeTypes = formData.getAll("chargeType").map(String);
  const chargeBases = formData.getAll("chargeBasis").map(String);
  const chargeCurrencies = formData.getAll("chargeCurrency").map(String);
  const quantities = formData.getAll("chargeQuantity").map(String);
  const buyRates = formData.getAll("chargeBuyRate").map(String);
  const sellRates = formData.getAll("chargeSellRate").map(String);
  const exchangeRates = formData.getAll("chargeExchangeRateToBDT").map(String);
  const vendorIds = formData.getAll("chargeVendorId").map(String);
  const chargeRemarks = formData.getAll("chargeRemarks").map(String);

  const rows = chargeNames
    .map((chargeName, index) => ({
      id: chargeIds[index] || undefined,
      chargeName,
      chargeType: chargeTypes[index] ?? "FREIGHT",
      chargeBasis: chargeBases[index] ?? "PER_SHIPMENT",
      currency: chargeCurrencies[index] ?? "BDT",
      quantity: quantities[index] ?? "1",
      buyRate: buyRates[index] ?? "0",
      sellRate: sellRates[index] ?? "0",
      exchangeRateToBDT: exchangeRates[index] ?? "1",
      vendorId: vendorIds[index] || undefined,
      remarks: chargeRemarks[index] || undefined,
    }))
    .filter((row) => row.chargeName.trim());

  if (!rows.length) {
    return { charges: [] as QuotationChargeRowInput[] };
  }

  const parsed = rows.map((row) => quotationChargeRowSchema.safeParse(row));
  const invalid = parsed.find((item) => !item.success);
  if (invalid && !invalid.success) {
    const fieldErrors = invalid.error.flatten().fieldErrors;
    const firstField = Object.keys(fieldErrors)[0];
    const firstMessage =
      firstField && fieldErrors[firstField as keyof typeof fieldErrors]?.[0];
    return {
      error: firstMessage ?? "Please fix the highlighted charge fields.",
      errors: fieldErrors,
    };
  }

  return { charges: parsed.map((item) => item.data!) };
}

async function syncQuotationCharges(
  tx: Prisma.TransactionClient,
  quotationId: string,
  companyId: string,
  charges: QuotationChargeRowInput[],
) {
  const existing = await tx.quotationcharge.findMany({
    where: { quotationId, companyId, deletedAt: null },
    select: { id: true },
  });
  const submittedIds = new Set(
    charges.map((charge) => charge.id).filter((id): id is string => Boolean(id)),
  );

  for (const charge of existing) {
    if (!submittedIds.has(charge.id)) {
      await tx.quotationcharge.update({
        where: { id: charge.id },
        data: { deletedAt: new Date(), updatedAt: new Date() },
      });
    }
  }

  for (const charge of charges) {
    const amounts = calculateAmounts(charge);
    const data = {
      chargeName: charge.chargeName,
      chargeType: charge.chargeType,
      chargeBasis: charge.chargeBasis,
      currency: charge.currency,
      quantity: charge.quantity,
      buyRate: charge.buyRate,
      sellRate: charge.sellRate,
      exchangeRateToBDT: charge.exchangeRateToBDT,
      vendorId: charge.vendorId ?? null,
      remarks: charge.remarks ?? null,
      ...amounts,
    };

    if (charge.id && existing.some((item) => item.id === charge.id)) {
      await tx.quotationcharge.update({
        where: { id: charge.id },
        data: { ...data, updatedAt: new Date() },
      });
      continue;
    }

    await tx.quotationcharge.create({
      data: {
        id: crypto.randomUUID(),
        ...data,
        quotationId,
        companyId,
        updatedAt: new Date(),
      },
    });
  }

  await recalculateQuotationTotals(tx, quotationId);
}

export async function saveQuotation(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const { user, companyId: scopedCompanyId } = await getScopedCompanyId(
    id ? "quotations:update" : "quotations:create",
  );
  const targetCompanyId = scopedCompanyId ?? getString(formData, "companyId");
  if (!targetCompanyId) return validationError("Company is required.");
  const moduleError = await ensureModuleAccess(targetCompanyId, "QUOTATIONS");
  if (moduleError) return validationError(moduleError);
  const { accessibleBranchIds, defaultBranchId } = await getBranchWriteScope({
    userId: user.id,
    companyId: targetCompanyId,
    permissions: user.permissions ?? [],
  });

  const parsed = quotationSchema.safeParse({
    id,
    customerId: getString(formData, "customerId"),
    shipmentJobId: getString(formData, "shipmentJobId"),
    shipmentType: getString(formData, "shipmentType"),
    transportMode: getString(formData, "transportMode"),
    loadType: getString(formData, "loadType"),
    tradeTerm: getString(formData, "tradeTerm"),
    originCountry: getString(formData, "originCountry"),
    originPort: getString(formData, "originPort"),
    destinationCountry: getString(formData, "destinationCountry"),
    destinationPort: getString(formData, "destinationPort"),
    cargoDescription: getString(formData, "cargoDescription"),
    packageCount: getString(formData, "packageCount"),
    grossWeight: getString(formData, "grossWeight"),
    chargeableWeight: getString(formData, "chargeableWeight"),
    cbm: getString(formData, "cbm"),
    validUntil: getString(formData, "validUntil"),
    remarks: getString(formData, "remarks"),
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted quotation fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const referenceError = await validateCompanyReferences({
    companyId: targetCompanyId,
    customerId: parsed.data.customerId,
    shipmentJobId: parsed.data.shipmentJobId,
  });
  if (referenceError) return validationError(referenceError);

  const chargeResult = parseQuotationCharges(formData);
  if ("error" in chargeResult) {
    return validationError(
      chargeResult.error ?? "Please fix the highlighted charge fields.",
      chargeResult.errors,
    );
  }
  const chargeRows = chargeResult.charges;

  for (const charge of chargeRows) {
    const vendorError = await validateCompanyReferences({
      companyId: targetCompanyId,
      vendorId: charge.vendorId,
    });
    if (vendorError) return validationError(vendorError);
  }

  if (parsed.data.shipmentJobId && (await findLockedShipmentId(parsed.data.shipmentJobId, targetCompanyId))) {
    return validationError("Finance is locked for this shipment.");
  }

  if (id) {
    const existing = await getQuotationForAction(id, scopedCompanyId, accessibleBranchIds);
    if (!existing) return validationError("Quotation was not found.");
    const existingModuleError = await ensureModuleAccess(existing.companyId, "QUOTATIONS");
    if (existingModuleError) return validationError(existingModuleError);
    if (await linkedLockedQuotationShipmentId(existing, scopedCompanyId)) {
      return validationError("Finance is locked for the linked shipment.");
    }
    if (!["DRAFT", "SENT"].includes(existing.status) && !user.roles.includes("SUPER_ADMIN") && !user.roles.includes("COMPANY_ADMIN")) {
      return validationError("This quotation is locked and cannot be edited.");
    }
    if (existing.shipmentRequestId) {
      const linkedRequest = await prisma.shipmentrequest.findFirst({
        where: {
          id: existing.shipmentRequestId,
          companyId: existing.companyId,
          customerId: parsed.data.customerId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!linkedRequest) {
        return validationError(
          "A request-linked quotation must keep the same customer.",
          { customerId: ["Customer must match the linked shipment request."] },
        );
      }
    }
    const data = { ...parsed.data };
    delete data.id;
    const quotation = await prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id },
        data: { ...data, updatedAt: new Date() },
      });
      if (formData.getAll("chargeName").length) {
        await syncQuotationCharges(tx, updated.id, updated.companyId, chargeRows);
      }
      return updated;
    });
    await audit({
      companyId: quotation.companyId,
      actorId: user.id,
      action: "QUOTATION_UPDATED",
      entityType: "Quotation",
      entityId: quotation.id,
      metadata: { quoteNo: quotation.quoteNo },
    });
    revalidateQuotationPaths(quotation.id);
    redirect(`/dashboard/quotations/${quotation.id}`);
  }

  let quotation: { id: string; companyId: string; quoteNo: string } | null = null;
  const branchId = await resolveWritableBranchId({
    companyId: targetCompanyId,
    accessibleBranchIds,
    defaultBranchId,
    requestedBranchId: getString(formData, "branchId") || null,
  });
  if (!branchId) return validationError("Assign an active default branch before creating a quotation.");
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      quotation = await prisma.$transaction(async (tx) => {
        const quoteNo = await generateQuoteNo(tx, targetCompanyId);
        const data = { ...parsed.data };
        delete data.id;
        const created = await tx.quotation.create({
          data: {
            id: crypto.randomUUID(),
            ...data,
            companyId: targetCompanyId,
            branchId,
            quoteNo,
            createdById: user.id,
            updatedAt: new Date(),
          },
        });
        if (chargeRows.length) {
          await syncQuotationCharges(tx, created.id, created.companyId, chargeRows);
        }
        return created;
      });
      break;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        if (attempt === maxAttempts) {
          return validationError("Could not reserve a unique quote number. Please try again.");
        }
        continue;
      }
      throw error;
    }
  }

  if (!quotation) {
    return validationError("Could not reserve a unique quote number. Please try again.");
  }

  await audit({
    companyId: quotation.companyId,
    actorId: user.id,
    action: "QUOTATION_CREATED",
    entityType: "Quotation",
    entityId: quotation.id,
    metadata: { quoteNo: quotation.quoteNo },
  });
  revalidateQuotationPaths(quotation.id);
  redirect(`/dashboard/quotations/${quotation.id}`);
}

export async function saveQuotationCharge(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const { user, companyId } = await getScopedCompanyId("quotations:update");
  const parsed = quotationChargeSchema.safeParse({
    id,
    quotationId: getString(formData, "quotationId"),
    chargeName: getString(formData, "chargeName"),
    chargeType: getString(formData, "chargeType"),
    chargeBasis: getString(formData, "chargeBasis"),
    currency: getString(formData, "currency"),
    quantity: getString(formData, "quantity"),
    buyRate: getString(formData, "buyRate"),
    sellRate: getString(formData, "sellRate"),
    exchangeRateToBDT: getString(formData, "exchangeRateToBDT"),
    vendorId: getString(formData, "vendorId"),
    remarks: getString(formData, "remarks"),
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted charge fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const quotation = await getQuotationForAction(parsed.data.quotationId, companyId);
  if (!quotation) return validationError("Quotation was not found.");
  const moduleError = await ensureModuleAccess(quotation.companyId, "QUOTATIONS");
  if (moduleError) return validationError(moduleError);
  if (await linkedLockedQuotationShipmentId(quotation, companyId)) {
    return validationError("Finance is locked for the linked shipment.");
  }
  const referenceError = await validateCompanyReferences({
    companyId: quotation.companyId,
    vendorId: parsed.data.vendorId,
  });
  if (referenceError) return validationError(referenceError);

  const amounts = calculateAmounts(parsed.data);
  const data = {
    ...parsed.data,
    vendorId: parsed.data.vendorId ?? null,
    remarks: parsed.data.remarks ?? null,
    ...amounts,
  };
  delete data.id;

  if (id) {
    const existingCharge = await prisma.quotationcharge.findFirst({
      where: {
        id,
        quotationId: quotation.id,
        companyId: quotation.companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!existingCharge) return validationError("Charge was not found.");
  }

  const charge = await prisma.$transaction(async (tx) => {
    const result = id
      ? await tx.quotationcharge.update({
          where: { id },
          data: { ...data, updatedAt: new Date() },
        })
      : await tx.quotationcharge.create({
          data: {
            id: crypto.randomUUID(),
            ...data,
            quotationId: quotation.id,
            companyId: quotation.companyId,
            updatedAt: new Date(),
          },
        });
    await recalculateQuotationTotals(tx, quotation.id);
    return result;
  });

  await audit({
    companyId: quotation.companyId,
    actorId: user.id,
    action: id ? "QUOTATION_CHARGE_UPDATED" : "QUOTATION_CHARGE_CREATED",
    entityType: "QuotationCharge",
    entityId: charge.id,
    metadata: { quotationId: quotation.id, quoteNo: quotation.quoteNo, chargeName: charge.chargeName },
  });
  revalidateQuotationPaths(quotation.id);
  return successState(id ? "Charge updated." : "Charge added.");
}

export async function deleteQuotationCharge(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("quotations:update");
  const scope = companyId ? await getCurrentBranchScope(companyId) : null;
  const id = getString(formData, "id");
  const charge = await prisma.quotationcharge.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...(scope !== null ? { quotation: { branchId: { in: scope } } } : {}),
    },
    include: { quotation: { select: { id: true, quoteNo: true, shipmentJobId: true, convertedShipmentJobId: true } } },
  });
  if (!charge) return;
  if (await ensureModuleAccess(charge.companyId, "QUOTATIONS")) return;
  if (await linkedLockedQuotationShipmentId(charge.quotation, companyId)) return;
  await prisma.$transaction(async (tx) => {
    await tx.quotationcharge.update({ where: { id }, data: { deletedAt: new Date(), updatedAt: new Date() } });
    await recalculateQuotationTotals(tx, charge.quotation.id);
  });
  await audit({
    companyId: charge.companyId,
    actorId: user.id,
    action: "QUOTATION_CHARGE_DELETED",
    entityType: "QuotationCharge",
    entityId: charge.id,
    metadata: { quotationId: charge.quotation.id, quoteNo: charge.quotation.quoteNo, chargeName: charge.chargeName },
  });
  revalidateQuotationPaths(charge.quotation.id);
}

export async function updateQuotationStatus(formData: FormData) {
  const targetStatus = getString(formData, "status");
  const permission = targetStatus === "SENT" ? "quotations:update" : "quotations:approve";
  const { user, companyId } = await getScopedCompanyId(permission);
  const parsed = quotationStatusSchema.safeParse({
    quotationId: getString(formData, "quotationId"),
    status: targetStatus,
  });
  if (!parsed.success) return;
  const quotation = await getQuotationForAction(parsed.data.quotationId, companyId);
  if (!quotation) return;
  if (await ensureModuleAccess(quotation.companyId, "QUOTATIONS")) return;
  if (
    quotation.shipmentRequestId &&
    ["ACCEPTED", "REJECTED"].includes(parsed.data.status)
  ) {
    return;
  }
  const updated = await prisma.quotation.update({
    where: { id: quotation.id },
    data: {
      status: parsed.data.status,
      approvedById: ["ACCEPTED", "REJECTED", "EXPIRED"].includes(parsed.data.status) ? user.id : quotation.approvedById,
      approvedAt: ["ACCEPTED", "REJECTED", "EXPIRED"].includes(parsed.data.status) ? new Date() : quotation.approvedAt,
      updatedAt: new Date(),
    },
  });
  await audit({
    companyId: updated.companyId,
    actorId: user.id,
    action: "QUOTATION_STATUS_CHANGED",
    entityType: "Quotation",
    entityId: updated.id,
    metadata: { quoteNo: updated.quoteNo, from: quotation.status, to: updated.status },
  });
  revalidateQuotationPaths(updated.id);
}

export async function deleteQuotation(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("quotations:delete");
  const id = getString(formData, "id");
  const quotation = await getQuotationForAction(id, companyId);
  if (!quotation) return;
  if (await ensureModuleAccess(quotation.companyId, "QUOTATIONS")) return;
  const deleted = await prisma.quotation.update({
    where: { id },
    data: { deletedAt: new Date(), updatedAt: new Date() },
  });
  await audit({
    companyId: deleted.companyId,
    actorId: user.id,
    action: "QUOTATION_DELETED",
    entityType: "Quotation",
    entityId: deleted.id,
    metadata: { quoteNo: deleted.quoteNo },
  });
  revalidateAdminPaths();
}

export async function saveShipmentCostItem(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const { user, companyId } = await getScopedCompanyId("costing:update");
  const parsed = shipmentCostSchema.safeParse({
    id,
    shipmentJobId: getString(formData, "shipmentJobId"),
    chargeName: getString(formData, "chargeName"),
    chargeType: getString(formData, "chargeType"),
    chargeBasis: getString(formData, "chargeBasis"),
    currency: getString(formData, "currency"),
    quantity: getString(formData, "quantity"),
    buyRate: getString(formData, "buyRate"),
    sellRate: getString(formData, "sellRate"),
    exchangeRateToBDT: getString(formData, "exchangeRateToBDT"),
    vendorId: getString(formData, "vendorId"),
    customerId: getString(formData, "customerId"),
    sourceQuotationId: getString(formData, "sourceQuotationId"),
    remarks: getString(formData, "remarks"),
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted costing fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const shipment = await getShipmentForCosting(parsed.data.shipmentJobId, companyId);
  if (!shipment) return validationError("Shipment was not found.");
  const moduleError = await ensureModuleAccess(shipment.companyId, "COSTING");
  if (moduleError) return validationError(moduleError);
  if (isFinanceLocked(shipment.financeCloseStatus)) {
    return validationError("Finance is locked for this shipment.");
  }
  const referenceError = await validateCompanyReferences({
    companyId: shipment.companyId,
    vendorId: parsed.data.vendorId,
    customerId: parsed.data.customerId,
    quotationId: parsed.data.sourceQuotationId,
  });
  if (referenceError) return validationError(referenceError);

  if (id) {
    const existing = await prisma.shipmentcostitem.findFirst({
      where: { id, shipmentJobId: shipment.id, companyId: shipment.companyId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return validationError("Cost item was not found.");
  }

  const amounts = calculateAmounts(parsed.data);
  const data = {
    ...parsed.data,
    vendorId: parsed.data.vendorId ?? null,
    customerId: parsed.data.customerId ?? null,
    sourceQuotationId: parsed.data.sourceQuotationId ?? null,
    remarks: parsed.data.remarks ?? null,
    ...amounts,
  };
  delete data.id;

  const item = await prisma.$transaction(async (tx) => {
    const result = id
      ? await tx.shipmentcostitem.update({ where: { id }, data: { ...data, updatedAt: new Date() } })
      : await tx.shipmentcostitem.create({
          data: {
            id: crypto.randomUUID(),
            ...data,
            companyId: shipment.companyId,
            createdById: user.id,
            updatedAt: new Date(),
          },
        });
    await recalculateShipmentCostTotals(tx, shipment.id);
    return result;
  });

  await audit({
    companyId: shipment.companyId,
    actorId: user.id,
    action: id ? "SHIPMENT_COST_UPDATED" : "SHIPMENT_COST_CREATED",
    entityType: "ShipmentCostItem",
    entityId: item.id,
    metadata: { shipmentJobId: shipment.id, jobNo: shipment.jobNo, chargeName: item.chargeName },
  });
  revalidateAdminPaths();
  return successState(id ? "Cost item updated." : "Cost item added.");
}

export async function deleteShipmentCostItem(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("costing:delete");
  const scope = companyId ? await getCurrentBranchScope(companyId) : null;
  const id = getString(formData, "id");
  const item = await prisma.shipmentcostitem.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
      ...(scope !== null ? { shipmentjob: { branchId: { in: scope } } } : {}),
    },
    include: { shipmentjob: { select: { id: true, jobNo: true, financeCloseStatus: true } } },
  });
  if (!item) return;
  if (await ensureModuleAccess(item.companyId, "COSTING")) return;
  if (isFinanceLocked(item.shipmentjob.financeCloseStatus)) return;
  await prisma.$transaction(async (tx) => {
    await tx.shipmentcostitem.update({ where: { id }, data: { deletedAt: new Date(), updatedAt: new Date() } });
    await recalculateShipmentCostTotals(tx, item.shipmentjob.id);
  });
  await audit({
    companyId: item.companyId,
    actorId: user.id,
    action: "SHIPMENT_COST_DELETED",
    entityType: "ShipmentCostItem",
    entityId: item.id,
    metadata: { shipmentJobId: item.shipmentjob.id, jobNo: item.shipmentjob.jobNo, chargeName: item.chargeName },
  });
  revalidateAdminPaths();
}

export async function importQuotationChargesToShipmentAction(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const shipmentJobId = getString(formData, "shipmentJobId");
  const quotationId = getString(formData, "quotationId");

  if (!shipmentJobId || !quotationId) {
    return validationError("Shipment and Quotation IDs are required.");
  }

  const { user, companyId } = await getScopedCompanyId("costing:update");
  const shipment = await getShipmentForCosting(shipmentJobId, companyId);
  if (!shipment) return validationError("Shipment was not found.");
  if (isFinanceLocked(shipment.financeCloseStatus)) {
    return validationError("Finance is locked for this shipment.");
  }

  const quotation = await getQuotationForAction(quotationId, shipment.companyId);
  if (!quotation) return validationError("Quotation was not found.");

  const copiedCount = await copyQuotationChargesToShipmentJob(
    prisma,
    quotation.id,
    shipment.id,
    user.id,
  );

  if (copiedCount === 0) {
    return successState("No new charges were imported (or all charges were already imported).");
  }

  await audit({
    companyId: shipment.companyId,
    actorId: user.id,
    action: "SHIPMENT_COST_IMPORTED_FROM_QUOTATION",
    entityType: "ShipmentJob",
    entityId: shipment.id,
    metadata: { shipmentJobId: shipment.id, jobNo: shipment.jobNo, quotationId: quotation.id, quoteNo: quotation.quoteNo, count: copiedCount },
  });

  revalidateAdminPaths();
  return successState(`Imported ${copiedCount} cost line(s) from quotation ${quotation.quoteNo}.`);
}
