import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import {
  buildInvoiceReportWhere,
  buildShipmentReportWhere,
  buildVendorBillReportWhere,
  decimalToNumber,
  parseReportFilters,
  sumBdt,
} from "@/lib/reports/filters";
import type { FinanceProfitSummary, ReportFilterParams } from "@/lib/reports/types";

export async function getFinanceProfitSummary(
  params: ReportFilterParams = {},
): Promise<FinanceProfitSummary> {
  const { companyId } = await requireReportsPage("financial");
  const filters = parseReportFilters(params);
  const shipmentWhere = buildShipmentReportWhere(companyId, filters);

  const [shipments, invoices, vendorBills] = await Promise.all([
    prisma.shipmentjob.findMany({
      where: shipmentWhere,
      select: {
        financeCloseStatus: true,
        totalSellAmount: true,
        totalBuyAmount: true,
        grossProfit: true,
        profitMarginPercent: true,
        finalTotalSellAmount: true,
        finalTotalBuyAmount: true,
        finalGrossProfit: true,
        finalProfitMarginPercent: true,
      },
      take: 2000,
    }),
    prisma.invoice.findMany({
      where: buildInvoiceReportWhere(companyId, filters),
      select: { dueAmount: true, exchangeRateToBDT: true },
      take: 2000,
    }),
    prisma.vendorbill.findMany({
      where: buildVendorBillReportWhere(companyId, filters),
      select: { dueAmount: true, exchangeRateToBDT: true },
      take: 2000,
    }),
  ]);

  const totalSell = shipments.reduce((sum, shipment) => sum + decimalToNumber(shipment.totalSellAmount), 0);
  const totalBuy = shipments.reduce((sum, shipment) => sum + decimalToNumber(shipment.totalBuyAmount), 0);
  const grossProfit = shipments.reduce((sum, shipment) => sum + decimalToNumber(shipment.grossProfit), 0);
  const finalSell = shipments.reduce((sum, shipment) => sum + decimalToNumber(shipment.finalTotalSellAmount), 0);
  const finalBuy = shipments.reduce((sum, shipment) => sum + decimalToNumber(shipment.finalTotalBuyAmount), 0);
  const finalGrossProfit = shipments.reduce((sum, shipment) => sum + decimalToNumber(shipment.finalGrossProfit), 0);
  const lockedJobs = shipments.filter((shipment) => shipment.financeCloseStatus === "LOCKED");

  return {
    totalSell,
    totalBuy,
    grossProfit,
    profitMarginPercent: totalSell ? (grossProfit / totalSell) * 100 : 0,
    finalSell,
    finalBuy,
    finalGrossProfit,
    finalProfitMarginPercent: finalSell ? (finalGrossProfit / finalSell) * 100 : 0,
    receivableOutstanding: sumBdt(invoices, (invoice) => invoice.dueAmount),
    payableOutstanding: sumBdt(vendorBills, (bill) => bill.dueAmount),
    lockedJobCount: lockedJobs.length,
    closeReadyJobCount: shipments.filter((shipment) => shipment.financeCloseStatus === "CLOSE_READY").length,
    openFinanceJobCount: shipments.filter((shipment) => shipment.financeCloseStatus === "OPEN").length,
    lowMarginJobCount: shipments.filter((shipment) => {
      const margin = shipment.financeCloseStatus === "LOCKED"
        ? decimalToNumber(shipment.finalProfitMarginPercent)
        : decimalToNumber(shipment.profitMarginPercent);
      return margin > 0 && margin < 10;
    }).length,
    lossMakingJobCount: shipments.filter((shipment) => {
      const profit = shipment.financeCloseStatus === "LOCKED"
        ? decimalToNumber(shipment.finalGrossProfit)
        : decimalToNumber(shipment.grossProfit);
      return profit < 0;
    }).length,
  };
}
