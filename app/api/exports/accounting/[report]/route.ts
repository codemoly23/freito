import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";
import { generateCsv, type CsvColumn } from "@/lib/exports/csv";
import type { ReportSearchParams } from "@/lib/reports/date-range";
import type { LedgerGroupSummary } from "@/lib/reports/accounting-summary";
import { getTrialBalanceSummary } from "@/lib/reports/trial-balance";
import { getProfitLossSummary } from "@/lib/reports/profit-loss";
import { getBalanceSheetSummary } from "@/lib/reports/balance-sheet";

type CsvRow = Record<string, string | number>;

function round(value: number) {
  return Math.round(value * 100) / 100;
}
function cell(value: number) {
  return value ? round(value) : "";
}

function debitCreditColumns(currencyLabel: string, showBDT: boolean): CsvColumn<CsvRow>[] {
  const columns: CsvColumn<CsvRow>[] = [
    { header: "Particulars", accessor: (r) => r.particulars ?? "" },
    { header: `Debit (${currencyLabel})`, accessor: (r) => r.debit ?? "" },
    { header: `Credit (${currencyLabel})`, accessor: (r) => r.credit ?? "" },
    { header: "Debit (USD)", accessor: (r) => r.debitUSD ?? "" },
    { header: "Credit (USD)", accessor: (r) => r.creditUSD ?? "" },
  ];
  if (showBDT) {
    columns.push({ header: "Debit (BDT)", accessor: (r) => r.debitBDT ?? "" });
    columns.push({ header: "Credit (BDT)", accessor: (r) => r.creditBDT ?? "" });
  }
  return columns;
}

function amountColumns(currencyLabel: string, showBDT: boolean): CsvColumn<CsvRow>[] {
  const columns: CsvColumn<CsvRow>[] = [
    { header: "Particulars", accessor: (r) => r.particulars ?? "" },
    { header: `Amount (${currencyLabel})`, accessor: (r) => r.amount ?? "" },
    { header: "Amount (USD)", accessor: (r) => r.amountUSD ?? "" },
  ];
  if (showBDT) columns.push({ header: "Amount (BDT)", accessor: (r) => r.amountBDT ?? "" });
  return columns;
}

function groupRows(groups: LedgerGroupSummary[]): CsvRow[] {
  const rows: CsvRow[] = [];
  for (const group of groups) {
    rows.push({ particulars: group.groupName.toUpperCase() });
    for (const row of group.rows) {
      rows.push({
        particulars: row.ledgerName,
        debit: cell(row.debit),
        credit: cell(row.credit),
        debitUSD: cell(row.debitUSD),
        creditUSD: cell(row.creditUSD),
        debitBDT: cell(row.debitBDT),
        creditBDT: cell(row.creditBDT),
      });
    }
  }
  return rows;
}

async function buildTrialBalanceCsv(params: ReportSearchParams) {
  const summary = await getTrialBalanceSummary(params);
  const showBDT = summary.isAudit && summary.baseCurrency !== "BDT";
  const rows = groupRows(summary.groups);
  rows.push({
    particulars: "GRAND TOTAL",
    debit: round(summary.totalDebit),
    credit: round(summary.totalCredit),
    debitUSD: round(summary.totalDebitUSD),
    creditUSD: round(summary.totalCreditUSD),
    debitBDT: round(summary.totalDebitBDT),
    creditBDT: round(summary.totalCreditBDT),
  });
  return { rows, columns: debitCreditColumns(summary.baseCurrency, showBDT), range: summary.range };
}

async function buildProfitLossCsv(params: ReportSearchParams) {
  const summary = await getProfitLossSummary(params);
  const showBDT = summary.isAudit && summary.baseCurrency !== "BDT";
  const rows: CsvRow[] = [{ particulars: "INCOME" }];
  for (const row of summary.directIncome) {
    rows.push({ particulars: row.ledgerName, amount: cell(row.credit), amountUSD: cell(row.creditUSD), amountBDT: cell(row.creditBDT) });
  }
  for (const row of summary.indirectIncome) {
    rows.push({ particulars: `${row.ledgerName} (Indirect)`, amount: cell(row.credit), amountUSD: cell(row.creditUSD), amountBDT: cell(row.creditBDT) });
  }
  rows.push({ particulars: "Income Sub-Total", amount: round(summary.incomeSubTotal), amountUSD: round(summary.incomeSubTotalUSD), amountBDT: round(summary.incomeSubTotalBDT) });

  rows.push({ particulars: "DIRECT EXPENSES" });
  for (const row of summary.directExpense) {
    rows.push({ particulars: row.ledgerName, amount: cell(row.debit), amountUSD: cell(row.debitUSD), amountBDT: cell(row.debitBDT) });
  }
  rows.push({ particulars: "Direct Expenses Sub-Total", amount: round(summary.directExpenseTotal), amountUSD: round(summary.directExpenseTotalUSD), amountBDT: round(summary.directExpenseTotalBDT) });
  rows.push({ particulars: "Total Gross Profit", amount: round(summary.grossProfit), amountUSD: round(summary.grossProfitUSD), amountBDT: round(summary.grossProfitBDT) });

  rows.push({ particulars: "INDIRECT EXPENSES" });
  for (const row of summary.indirectExpense) {
    rows.push({ particulars: row.ledgerName, amount: cell(row.debit), amountUSD: cell(row.debitUSD), amountBDT: cell(row.debitBDT) });
  }
  rows.push({ particulars: "Indirect Expenses Sub-Total", amount: round(summary.indirectExpenseTotal), amountUSD: round(summary.indirectExpenseTotalUSD), amountBDT: round(summary.indirectExpenseTotalBDT) });
  rows.push({ particulars: "Total Net Profit", amount: round(summary.netProfit), amountUSD: round(summary.netProfitUSD), amountBDT: round(summary.netProfitBDT) });

  return { rows, columns: amountColumns(summary.baseCurrency, showBDT), range: summary.range };
}

async function buildBalanceSheetCsv(params: ReportSearchParams) {
  const summary = await getBalanceSheetSummary(params);
  const showBDT = summary.isAudit && summary.baseCurrency !== "BDT";
  const rows: CsvRow[] = [{ particulars: "ASSETS" }];
  for (const group of summary.assetGroups) {
    rows.push({ particulars: group.groupName.toUpperCase() });
    for (const row of group.rows) {
      rows.push({
        particulars: row.ledgerName,
        amount: cell(row.debit - row.credit),
        amountUSD: cell(row.debitUSD - row.creditUSD),
        amountBDT: cell(row.debitBDT - row.creditBDT),
      });
    }
    rows.push({
      particulars: "Sub Total",
      amount: round(group.subtotalDebit - group.subtotalCredit),
      amountUSD: round(group.subtotalDebitUSD - group.subtotalCreditUSD),
      amountBDT: round(group.subtotalDebitBDT - group.subtotalCreditBDT),
    });
  }
  rows.push({ particulars: "Total Assets", amount: round(summary.totalAssets), amountUSD: round(summary.totalAssetsUSD), amountBDT: round(summary.totalAssetsBDT) });

  rows.push({ particulars: "LIABILITIES & EQUITY" });
  for (const group of summary.liabilityEquityGroups) {
    rows.push({ particulars: group.groupName.toUpperCase() });
    for (const row of group.rows) {
      rows.push({
        particulars: row.ledgerName,
        amount: cell(row.credit - row.debit),
        amountUSD: cell(row.creditUSD - row.debitUSD),
        amountBDT: cell(row.creditBDT - row.debitBDT),
      });
    }
    rows.push({
      particulars: "Sub Total",
      amount: round(group.subtotalCredit - group.subtotalDebit),
      amountUSD: round(group.subtotalCreditUSD - group.subtotalDebitUSD),
      amountBDT: round(group.subtotalCreditBDT - group.subtotalDebitBDT),
    });
  }
  rows.push({ particulars: "PROFIT & LOSS A/C" });
  rows.push({ particulars: "Net Profit", amount: cell(summary.netProfit), amountUSD: cell(summary.netProfitUSD), amountBDT: cell(summary.netProfitBDT) });
  rows.push({ particulars: "Total Liabilities & Equity", amount: round(summary.totalLiabilitiesAndEquity), amountUSD: round(summary.totalLiabilitiesAndEquityUSD), amountBDT: round(summary.totalLiabilitiesAndEquityBDT) });

  return { rows, columns: amountColumns(summary.baseCurrency, showBDT), range: summary.range };
}

const builders = {
  "trial-balance": buildTrialBalanceCsv,
  "profit-loss": buildProfitLossCsv,
  "balance-sheet": buildBalanceSheetCsv,
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  const builder = builders[report as keyof typeof builders];
  if (!builder) return new NextResponse("Not found", { status: 404 });

  // Same blanket "exports:csv" gate the generic /api/exports/[entity] route
  // enforces -- reports:accounting alone (checked again below, inside each
  // summary function via requireAccountingReportsPage) is not sufficient on
  // its own for CSV download rights.
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!hasPermission(user, "exports:csv")) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const searchParams: ReportSearchParams = {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  // requireAccountingReportsPage() (called inside each summary function)
  // handles the permission + audit-scope check and redirects on failure --
  // exactly the same guard the report pages themselves use, so the CSV can
  // never contain data the viewer couldn't already see on screen.
  const { rows, columns, range } = await builder(searchParams);
  const csv = generateCsv(rows, columns);

  const fileName = `${report}-${range.fromInput}-to-${range.toInput}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
