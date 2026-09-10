import { requireAccountingReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { applyBooksOpeningDateDefault, getLedgerBalances, groupByLedgerGroup } from "@/lib/reports/accounting-summary";
import { getProfitLossSummary } from "@/lib/reports/profit-loss";

export async function getBalanceSheetSummary(params: ReportSearchParams) {
  const { companyId, isAudit, companyName } = await requireAccountingReportsPage();
  const range = await applyBooksOpeningDateDefault(companyId!, params, getReportDateRange(params));
  const [{ baseCurrency, rows }, pnl] = await Promise.all([
    getLedgerBalances(companyId!, range, { includeOpeningBalance: true }),
    getProfitLossSummary(params),
  ]);

  const assetRows = rows.filter((row) => row.natureType === "ASSET");
  const liabilityEquityRows = rows.filter((row) => row.natureType === "LIABILITY" || row.natureType === "EQUITY");

  const assetGroups = groupByLedgerGroup(assetRows);
  const liabilityEquityGroups = groupByLedgerGroup(liabilityEquityRows);

  const totalAssets = assetRows.reduce((sum, row) => sum + row.debit - row.credit, 0);
  const totalAssetsUSD = assetRows.reduce((sum, row) => sum + row.debitUSD - row.creditUSD, 0);
  const totalAssetsBDT = assetRows.reduce((sum, row) => sum + row.debitBDT - row.creditBDT, 0);
  // Net Profit rolls into this side as a synthetic "Profit & Loss A/c" line —
  // matching the client's sample, which injects the period's net profit here
  // so both sides of the sheet balance.
  const totalLiabilitiesAndEquity =
    liabilityEquityRows.reduce((sum, row) => sum + row.credit - row.debit, 0) + pnl.netProfit;
  const totalLiabilitiesAndEquityUSD =
    liabilityEquityRows.reduce((sum, row) => sum + row.creditUSD - row.debitUSD, 0) + pnl.netProfitUSD;
  const totalLiabilitiesAndEquityBDT =
    liabilityEquityRows.reduce((sum, row) => sum + row.creditBDT - row.debitBDT, 0) + pnl.netProfitBDT;

  return {
    range,
    baseCurrency,
    isAudit,
    companyName,
    assetGroups,
    liabilityEquityGroups,
    netProfit: pnl.netProfit,
    netProfitUSD: pnl.netProfitUSD,
    netProfitBDT: pnl.netProfitBDT,
    totalAssets,
    totalAssetsUSD,
    totalAssetsBDT,
    totalLiabilitiesAndEquity,
    totalLiabilitiesAndEquityUSD,
    totalLiabilitiesAndEquityBDT,
    balanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 1,
  };
}
