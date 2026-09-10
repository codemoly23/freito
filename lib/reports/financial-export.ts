import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { decimalNumber } from "@/lib/reports/formatters";

const financeStatuses = ["OPEN", "CLOSE_READY", "LOCKED"] as const;
const modes = ["SEA", "AIR", "LAND"] as const;
const shipmentTypes = ["IMPORT", "EXPORT"] as const;
const scopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;
const invoiceStatuses = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
const vendorBillStatuses = ["DRAFT", "RECEIVED", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
export const agingBuckets = ["CURRENT", "1_30", "31_60", "61_90", "90_PLUS"] as const;
const profitStatuses = ["PROFITABLE", "LOW_MARGIN", "LOSS_MAKING"] as const;

/**
 * Shared data-fetch behind the Financial Report's four detailed tables
 * (job-wise profit, finance closeout, receivable aging, payable aging) --
 * used by both the report page (default `limit`s matching its current
 * on-screen `take` values) and the CSV export route (which passes much
 * higher limits so the download isn't truncated the same way the on-screen
 * tables are). Keeping exactly one function means the CSV can never drift
 * from what the page shows for the same filters/permissions.
 */
export async function getFinancialReportRows(
  params: ReportSearchParams,
  limits: { jobs?: number; invoices?: number; vendorBills?: number } = {},
) {
  const { companyId, branchWhere } = await requireReportsPage("financial");
  const range = getReportDateRange(params);
  const customerId = firstParam(params.customerId);
  const vendorId = firstParam(params.vendorId);
  const financeCloseStatus = enumParam(params.financeCloseStatus, financeStatuses);
  const transportMode = enumParam(params.transportMode, modes);
  const shipmentType = enumParam(params.shipmentType, shipmentTypes);
  const serviceScope = enumParam(params.serviceScope, scopes);
  const agingBucket = enumParam(params.agingBucket, agingBuckets);
  const profitStatus = enumParam(params.profitStatus, profitStatuses);
  const invoiceStatus = enumParam(params.invoiceStatus, invoiceStatuses);
  const vendorBillStatus = enumParam(params.vendorBillStatus, vendorBillStatuses);

  const shipmentWhere: Prisma.shipmentjobWhereInput = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    createdAt: { gte: range.from, lte: range.to },
    ...(customerId ? { customerId } : {}),
    ...(financeCloseStatus ? { financeCloseStatus: financeCloseStatus as Prisma.shipmentjobWhereInput["financeCloseStatus"] } : {}),
    ...(transportMode ? { transportMode: transportMode as Prisma.shipmentjobWhereInput["transportMode"] } : {}),
    ...(shipmentType ? { shipmentType: shipmentType as Prisma.shipmentjobWhereInput["shipmentType"] } : {}),
    ...(serviceScope ? { serviceScope: serviceScope as Prisma.shipmentjobWhereInput["serviceScope"] } : {}),
  };
  const invoiceWhere: Prisma.invoiceWhereInput = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    invoiceDate: { gte: range.from, lte: range.to },
    status: invoiceStatus ? (invoiceStatus as Prisma.invoiceWhereInput["status"]) : { not: "CANCELLED" },
    ...(customerId ? { customerId } : {}),
  };
  const vendorBillWhere: Prisma.vendorbillWhereInput = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    billDate: { gte: range.from, lte: range.to },
    status: vendorBillStatus ? (vendorBillStatus as Prisma.vendorbillWhereInput["status"]) : { not: "CANCELLED" },
    ...(vendorId ? { vendorId } : {}),
  };

  const [jobs, invoices, vendorBills, customers, vendors] = await Promise.all([
    prisma.shipmentjob.findMany({
      where: shipmentWhere,
      select: {
        id: true,
        jobNo: true,
        transportMode: true,
        shipmentType: true,
        serviceScope: true,
        operationsStatus: true,
        financeCloseStatus: true,
        financeCloseReadyAt: true,
        financeLockedAt: true,
        allowUnpaidReceivableClose: true,
        vendorPayablesNotApplicable: true,
        totalSellAmount: true,
        totalBuyAmount: true,
        grossProfit: true,
        profitMarginPercent: true,
        finalTotalSellAmount: true,
        finalTotalBuyAmount: true,
        finalGrossProfit: true,
        finalProfitMarginPercent: true,
        deliveredAt: true,
        proofOfDeliveryAt: true,
        closedAt: true,
        customer: { select: { name: true } },
        invoice: { where: { deletedAt: null, status: { not: "CANCELLED" } }, select: { dueAmount: true, exchangeRateToBDT: true } },
        vendorbill: { where: { deletedAt: null, status: { not: "CANCELLED" } }, select: { dueAmount: true, exchangeRateToBDT: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limits.jobs ?? 200,
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        invoiceNo: true,
        status: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
        exchangeRateToBDT: true,
        customer: { select: { name: true } },
        shipmentjob: { select: { id: true, jobNo: true } },
      },
      orderBy: { dueDate: "asc" },
      take: limits.invoices ?? 500,
    }),
    prisma.vendorbill.findMany({
      where: vendorBillWhere,
      select: {
        id: true,
        billNo: true,
        status: true,
        billDate: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
        exchangeRateToBDT: true,
        vendor: { select: { name: true } },
        shipmentjob: { select: { id: true, jobNo: true } },
      },
      orderBy: { dueDate: "asc" },
      take: limits.vendorBills ?? 500,
    }),
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    jobs,
    invoices,
    vendorBills,
    customers,
    vendors,
    range,
    customerId,
    vendorId,
    financeCloseStatus,
    transportMode,
    shipmentType,
    serviceScope,
    agingBucket,
    profitStatus,
    invoiceStatus,
    vendorBillStatus,
  };
}

export function bdtAmount(row: { exchangeRateToBDT: unknown }, value: unknown) {
  return decimalNumber(value) * decimalNumber(row.exchangeRateToBDT);
}

export function agingBucketFor(dueDate: Date | null, fallbackDate: Date, today: Date) {
  const base = dueDate ?? fallbackDate;
  const days = Math.floor((today.getTime() - new Date(base).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_PLUS";
}

export function agingBucketLabel(bucket: string) {
  return (
    {
      CURRENT: "Current / Not Due",
      "1_30": "1-30 Days",
      "31_60": "31-60 Days",
      "61_90": "61-90 Days",
      "90_PLUS": "90+ Days",
    }[bucket] ?? bucket
  );
}

export function filterJobsByProfitStatus<T extends { financeCloseStatus: string; grossProfit: unknown; profitMarginPercent: unknown; finalGrossProfit: unknown; finalProfitMarginPercent: unknown }>(
  jobs: T[],
  profitStatus: string | undefined,
) {
  if (!profitStatus) return jobs;
  return jobs.filter((job) => {
    const isLocked = job.financeCloseStatus === "LOCKED";
    const profit = isLocked ? decimalNumber(job.finalGrossProfit) : decimalNumber(job.grossProfit);
    const margin = isLocked ? decimalNumber(job.finalProfitMarginPercent) : decimalNumber(job.profitMarginPercent);
    if (profitStatus === "PROFITABLE") return profit > 0 && margin >= 10;
    if (profitStatus === "LOW_MARGIN") return profit > 0 && margin < 10;
    if (profitStatus === "LOSS_MAKING") return profit < 0;
    return true;
  });
}

export function outstandingFor(rows: { dueAmount: unknown; exchangeRateToBDT: unknown }[]) {
  return rows.reduce((sum, row) => sum + bdtAmount(row, row.dueAmount), 0);
}
