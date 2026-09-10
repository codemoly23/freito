import { requireAccountingReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { applyBooksOpeningDateDefault, getLedgerBalances, type LedgerBalanceRow } from "@/lib/reports/accounting-summary";

function sumDebit(rows: LedgerBalanceRow[]) {
  return rows.reduce((sum, row) => sum + row.debit, 0);
}
function sumCredit(rows: LedgerBalanceRow[]) {
  return rows.reduce((sum, row) => sum + row.credit, 0);
}
function sumDebitUSD(rows: LedgerBalanceRow[]) {
  return rows.reduce((sum, row) => sum + row.debitUSD, 0);
}
function sumCreditUSD(rows: LedgerBalanceRow[]) {
  return rows.reduce((sum, row) => sum + row.creditUSD, 0);
}
function sumDebitBDT(rows: LedgerBalanceRow[]) {
  return rows.reduce((sum, row) => sum + row.debitBDT, 0);
}
function sumCreditBDT(rows: LedgerBalanceRow[]) {
  return rows.reduce((sum, row) => sum + row.creditBDT, 0);
}

/**
 * Mirrors the client's own sample P&L exactly: Gross Profit is computed from
 * (Direct Income + Indirect Income) minus Direct Expenses only, and Net
 * Profit then subtracts Indirect Expenses — Indirect Income is folded into
 * the Income sub-total up front rather than held back for the Net Profit
 * stage, which is not the textbook convention but is what the client's
 * exported report actually does (verified against their sample numbers).
 */
export async function getProfitLossSummary(params: ReportSearchParams) {
  const { companyId, isAudit, companyName } = await requireAccountingReportsPage();
  const range = await applyBooksOpeningDateDefault(companyId!, params, getReportDateRange(params));
  const { baseCurrency, rows } = await getLedgerBalances(companyId!, range, { includeOpeningBalance: false });

  const directIncome = rows.filter((row) => row.natureType === "INCOME" && row.isDirect);
  const indirectIncome = rows.filter((row) => row.natureType === "INCOME" && !row.isDirect);
  const directExpense = rows.filter((row) => row.natureType === "EXPENSE" && row.isDirect);
  const indirectExpense = rows.filter((row) => row.natureType === "EXPENSE" && !row.isDirect);

  const directIncomeTotal = sumCredit(directIncome);
  const indirectIncomeTotal = sumCredit(indirectIncome);
  const incomeSubTotal = directIncomeTotal + indirectIncomeTotal;
  const directExpenseTotal = sumDebit(directExpense);
  const indirectExpenseTotal = sumDebit(indirectExpense);
  const grossProfit = incomeSubTotal - directExpenseTotal;
  const netProfit = grossProfit - indirectExpenseTotal;

  const directIncomeTotalUSD = sumCreditUSD(directIncome);
  const indirectIncomeTotalUSD = sumCreditUSD(indirectIncome);
  const incomeSubTotalUSD = directIncomeTotalUSD + indirectIncomeTotalUSD;
  const directExpenseTotalUSD = sumDebitUSD(directExpense);
  const indirectExpenseTotalUSD = sumDebitUSD(indirectExpense);
  const grossProfitUSD = incomeSubTotalUSD - directExpenseTotalUSD;
  const netProfitUSD = grossProfitUSD - indirectExpenseTotalUSD;

  const directIncomeTotalBDT = sumCreditBDT(directIncome);
  const indirectIncomeTotalBDT = sumCreditBDT(indirectIncome);
  const incomeSubTotalBDT = directIncomeTotalBDT + indirectIncomeTotalBDT;
  const directExpenseTotalBDT = sumDebitBDT(directExpense);
  const indirectExpenseTotalBDT = sumDebitBDT(indirectExpense);
  const grossProfitBDT = incomeSubTotalBDT - directExpenseTotalBDT;
  const netProfitBDT = grossProfitBDT - indirectExpenseTotalBDT;

  return {
    range,
    baseCurrency,
    isAudit,
    companyName,
    directIncome,
    indirectIncome,
    directExpense,
    indirectExpense,
    directIncomeTotal,
    indirectIncomeTotal,
    incomeSubTotal,
    directExpenseTotal,
    indirectExpenseTotal,
    grossProfit,
    netProfit,
    directIncomeTotalUSD,
    indirectIncomeTotalUSD,
    incomeSubTotalUSD,
    directExpenseTotalUSD,
    indirectExpenseTotalUSD,
    grossProfitUSD,
    netProfitUSD,
    directIncomeTotalBDT,
    indirectIncomeTotalBDT,
    incomeSubTotalBDT,
    directExpenseTotalBDT,
    indirectExpenseTotalBDT,
    grossProfitBDT,
    netProfitBDT,
  };
}
