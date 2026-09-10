import { requireAccountingReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { applyBooksOpeningDateDefault, getLedgerBalances, groupByLedgerGroup } from "@/lib/reports/accounting-summary";

export async function getTrialBalanceSummary(params: ReportSearchParams) {
  const { companyId, isAudit, companyName } = await requireAccountingReportsPage();
  const range = await applyBooksOpeningDateDefault(companyId!, params, getReportDateRange(params));
  const { baseCurrency, rows } = await getLedgerBalances(companyId!, range, { includeOpeningBalance: true });
  const groups = groupByLedgerGroup(rows);

  const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
  const totalDebitUSD = rows.reduce((sum, row) => sum + row.debitUSD, 0);
  const totalCreditUSD = rows.reduce((sum, row) => sum + row.creditUSD, 0);
  const totalDebitBDT = rows.reduce((sum, row) => sum + row.debitBDT, 0);
  const totalCreditBDT = rows.reduce((sum, row) => sum + row.creditBDT, 0);

  return {
    range,
    baseCurrency,
    isAudit,
    companyName,
    groups,
    totalDebit,
    totalCredit,
    totalDebitUSD,
    totalCreditUSD,
    totalDebitBDT,
    totalCreditBDT,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}
