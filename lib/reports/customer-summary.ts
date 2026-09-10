import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { decimalNumber } from "@/lib/reports/formatters";

export type CustomerPerformanceRow = {
  name: string;
  shipments: number;
  quotations: number;
  quotationTotal: number;
  acceptance: number;
  invoiced: number;
  receivable: number;
};

/**
 * Per-customer performance aggregation for the Customer Reports page's
 * "Customer performance" table. Shared by the page and the
 * `/api/exports/reports/customers` CSV route so both read from the exact
 * same query and aggregation logic. `financial` mirrors the
 * `reports:financial` permission check the page uses to gate the
 * Invoiced/Receivable columns -- the CSV route must apply the same gating.
 */
export async function getCustomerPerformanceRows(
  params: ReportSearchParams,
): Promise<{ rows: CustomerPerformanceRow[]; financial: boolean }> {
  const { user, companyId } = await requireReportsPage("customers");
  const range = getReportDateRange(params);
  const financial = hasPermission(user, "reports:financial");
  const customers = await prisma.customer.findMany({
    where: { companyId, deletedAt: null },
    select: {
      name: true,
      shipmentjob: { where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } }, select: { id: true } },
      quotation: { where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } }, select: { status: true, totalSellAmount: true } },
      invoice: { where: { deletedAt: null, status: { not: "CANCELLED" }, invoiceDate: { gte: range.from, lte: range.to } }, select: { totalAmount: true, dueAmount: true, exchangeRateToBDT: true } },
    },
  });
  const rows = customers.map((customer) => {
    const quotationTotal = customer.quotation.reduce((sum, quotation) => sum + decimalNumber(quotation.totalSellAmount), 0);
    const accepted = customer.quotation.filter((quotation) => ["ACCEPTED", "CONVERTED"].includes(quotation.status)).length;
    const decided = accepted + customer.quotation.filter((quotation) => ["REJECTED", "EXPIRED"].includes(quotation.status)).length;
    const invoiced = customer.invoice.reduce((sum, invoice) => sum + decimalNumber(invoice.totalAmount) * decimalNumber(invoice.exchangeRateToBDT), 0);
    const receivable = customer.invoice.reduce((sum, invoice) => sum + decimalNumber(invoice.dueAmount) * decimalNumber(invoice.exchangeRateToBDT), 0);
    return { name: customer.name, shipments: customer.shipmentjob.length, quotations: customer.quotation.length, quotationTotal, acceptance: decided ? accepted / decided * 100 : 0, invoiced, receivable };
  });
  const topShipments = [...rows].sort((a, b) => b.shipments - a.shipments);
  return { rows: topShipments, financial };
}
