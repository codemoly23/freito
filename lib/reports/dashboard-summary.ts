import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import {
  buildInvoiceReportWhere,
  buildShipmentReportWhere,
  buildVendorBillReportWhere,
  decimalToNumber,
  parseReportFilters,
  sumBdt,
} from "@/lib/reports/filters";
import type { ManagementDashboardSummary, ReportFilterParams } from "@/lib/reports/types";

type DashboardSummaryOptions = {
  lowMarginThreshold?: number;
};

export async function getManagementDashboardSummary(
  params: ReportFilterParams = {},
  options: DashboardSummaryOptions = {},
): Promise<ManagementDashboardSummary> {
  const { user, companyId, branchWhere } = await requireReportsPage();
  const canViewFinancials = hasPermission(user, "reports:financial");
  const filters = parseReportFilters(params);
  const shipmentWhere = { ...buildShipmentReportWhere(companyId, filters), ...branchWhere };
  const lowMarginThreshold = options.lowMarginThreshold ?? 10;
  const now = new Date();

  const [shipments, invoices, vendorBills, workflowDelayed, checklistItems] = await Promise.all([
    prisma.shipmentjob.findMany({
      where: shipmentWhere,
      select: {
        id: true,
        shipmentType: true,
        eta: true,
        closedAt: true,
        deliveredAt: true,
        proofOfDeliveryAt: true,
        financeCloseStatus: true,
        grossProfit: true,
        profitMarginPercent: true,
        finalGrossProfit: true,
        finalProfitMarginPercent: true,
        shipmentdocument: { where: { deletedAt: null }, select: { checklistItemId: true } },
      },
      take: 3000,
    }),
    prisma.invoice.findMany({
      where: { ...buildInvoiceReportWhere(companyId, filters), ...branchWhere },
      select: { totalAmount: true, dueAmount: true, exchangeRateToBDT: true },
      take: 3000,
    }),
    prisma.vendorbill.findMany({
      where: { ...buildVendorBillReportWhere(companyId, filters), ...branchWhere },
      select: { dueAmount: true, exchangeRateToBDT: true },
      take: 3000,
    }),
    prisma.shipmentworkflowstep.findMany({
      where: {
        companyId,
        deletedAt: null,
        dueDate: { lt: now },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
        shipmentjob: shipmentWhere,
      },
      select: { shipmentJobId: true },
      take: 3000,
    }),
    prisma.documentchecklistitem.findMany({
      where: { isActive: true, isRequired: true, OR: [{ companyId: null }, { companyId }] },
      select: { id: true, category: true },
    }),
  ]);

  const missingDocuments = shipments.reduce((sum, shipment) => {
    const present = new Set((shipment.shipmentdocument ?? []).map((document) => document.checklistItemId).filter(Boolean));
    const missing = checklistItems.filter((item) => (
      item.category === shipment.shipmentType || item.category === "COMMON"
    ) && !present.has(item.id));
    return sum + missing.length;
  }, 0);
  const delayedWorkflowJobIds = new Set(workflowDelayed.map((step) => step.shipmentJobId));
  const etaDelayedJobIds = shipments
    .filter((shipment) => shipment.eta && shipment.eta < now && !shipment.closedAt && !shipment.deliveredAt)
    .map((shipment) => shipment.id);
  const delayedJobs = new Set([...delayedWorkflowJobIds, ...etaDelayedJobIds]).size;

  const profitFor = (shipment: typeof shipments[number]) => (
    shipment.financeCloseStatus === "LOCKED"
      ? decimalToNumber(shipment.finalGrossProfit)
      : decimalToNumber(shipment.grossProfit)
  );
  const marginFor = (shipment: typeof shipments[number]) => (
    shipment.financeCloseStatus === "LOCKED"
      ? decimalToNumber(shipment.finalProfitMarginPercent)
      : decimalToNumber(shipment.profitMarginPercent)
  );

  return {
    totalShipments: shipments.length,
    openJobs: shipments.filter((shipment) => !shipment.closedAt).length,
    closedJobs: shipments.filter((shipment) => shipment.closedAt).length,
    activeShipments: shipments.filter((shipment) => !shipment.closedAt && !shipment.deliveredAt).length,
    monthlyRevenue: sumBdt(invoices, (invoice) => invoice.totalAmount),
    monthlyGrossProfit: canViewFinancials ? shipments.reduce((sum, shipment) => sum + profitFor(shipment), 0) : 0,
    pendingReceivable: sumBdt(invoices, (invoice) => invoice.dueAmount),
    pendingPayable: sumBdt(vendorBills, (bill) => bill.dueAmount),
    financeClosePending: shipments.filter((shipment) => (
      (shipment.closedAt || shipment.deliveredAt || shipment.proofOfDeliveryAt)
      && shipment.financeCloseStatus !== "LOCKED"
    )).length,
    financeLockedJobs: shipments.filter((shipment) => shipment.financeCloseStatus === "LOCKED").length,
    deliveredButFinanceOpen: shipments.filter((shipment) => (
      (shipment.deliveredAt || shipment.proofOfDeliveryAt) && shipment.financeCloseStatus !== "LOCKED"
    )).length,
    missingDocuments,
    delayedJobs,
    lowMarginJobs: canViewFinancials ? shipments.filter((shipment) => {
      const margin = marginFor(shipment);
      return margin > 0 && margin < lowMarginThreshold;
    }).length : 0,
    lossMakingJobs: canViewFinancials ? shipments.filter((shipment) => profitFor(shipment) < 0).length : 0,
  };
}
