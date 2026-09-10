import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { decimalNumber } from "@/lib/reports/formatters";

/**
 * Per-vendor summary aggregation for the Vendor Reports page's "Vendor
 * summary" table. Shared by the page and the `/api/exports/reports/vendors`
 * CSV route so both read from the exact same query and aggregation logic.
 * `financial` mirrors the `reports:financial` permission check the page
 * uses to gate the Bill amount/Payable due columns -- the CSV route must
 * apply the same gating.
 */
export async function getVendorSummaryRows(params: ReportSearchParams) {
  const { user, companyId } = await requireReportsPage("vendors");
  const range = getReportDateRange(params);
  const financial = hasPermission(user, "reports:financial");
  const vendors = await prisma.vendor.findMany({
    where: { companyId, deletedAt: null },
    select: {
      name: true, type: true,
      vendorbill: { where: { deletedAt: null, status: { not: "CANCELLED" }, billDate: { gte: range.from, lte: range.to } }, select: { billNo: true, billDate: true, totalAmount: true, dueAmount: true, exchangeRateToBDT: true } },
      shipmentworkflowstep: { where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } }, select: { title: true, status: true, dueDate: true, shipmentjob: { select: { jobNo: true } } } },
    },
  });
  const rows = vendors.map((vendor) => ({
    ...vendor,
    billed: vendor.vendorbill.reduce((sum, bill) => sum + decimalNumber(bill.totalAmount) * decimalNumber(bill.exchangeRateToBDT), 0),
    due: vendor.vendorbill.reduce((sum, bill) => sum + decimalNumber(bill.dueAmount) * decimalNumber(bill.exchangeRateToBDT), 0),
  })).sort((a, b) => b.billed - a.billed);
  return { rows, financial };
}

export type VendorSummaryRow = Awaited<ReturnType<typeof getVendorSummaryRows>>["rows"][number];
