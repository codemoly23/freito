import type { ReactNode } from "react";
import { ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { requireAccountingReportsPage } from "@/lib/reports/access";
import { type ReportSearchParams } from "@/lib/reports/date-range";
import { reportMoney } from "@/lib/reports/formatters";
import { getProfitLossSummary } from "@/lib/reports/profit-loss";
import { hasPermission } from "@/lib/permissions/rbac";
import { Button } from "@/components/ui/button";

export default async function ProfitLossReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const { user } = await requireAccountingReportsPage();
  const params = await searchParams;
  const summary = await getProfitLossSummary(params);
  const currency = summary.baseCurrency;
  const showBDT = summary.isAudit && currency !== "BDT";

  const headers = ["Particulars", `Amount (${currency})`, "Amount (USD)", ...(showBDT ? ["Amount (BDT)"] : [])];

  const incomeRow = (name: string, row: { credit: number; creditUSD: number; creditBDT: number }): ReactNode[] => [
    name,
    reportMoney(row.credit, currency),
    reportMoney(row.creditUSD, "USD"),
    ...(showBDT ? [reportMoney(row.creditBDT, "BDT")] : []),
  ];
  const expenseRow = (name: string, row: { debit: number; debitUSD: number; debitBDT: number }): ReactNode[] => [
    name,
    reportMoney(row.debit, currency),
    reportMoney(row.debitUSD, "USD"),
    ...(showBDT ? [reportMoney(row.debitBDT, "BDT")] : []),
  ];

  const incomeRows: ReactNode[][] = [
    ...summary.directIncome.map((row) => incomeRow(row.ledgerName, row)),
    ...summary.indirectIncome.map((row) => incomeRow(`${row.ledgerName} (Indirect)`, row)),
  ];
  const directExpenseRows: ReactNode[][] = summary.directExpense.map((row) => expenseRow(row.ledgerName, row));
  const indirectExpenseRows: ReactNode[][] = summary.indirectExpense.map((row) => expenseRow(row.ledgerName, row));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      {summary.isAudit ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Viewing: {summary.companyName} (audit mode) — this report only, not the rest of your dashboard.
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportHeader
          title="Profit & Loss Statement"
          description={`Direct and indirect income/expense for the selected period. Shown in ${currency} plus USD${showBDT ? " plus BDT" : ""}.`}
        />
        {hasPermission(user, "exports:csv") ? (
          <Button asChild size="sm" variant="outline">
            <a download href={`/api/exports/accounting/profit-loss?from=${summary.range.fromInput}&to=${summary.range.toInput}`}>
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>
      <ReportFilters from={summary.range.fromInput} to={summary.range.toInput} />

      <ReportTable
        title="Income"
        description="Direct Income (by job category) plus Indirect Income."
        headers={headers}
        rows={incomeRows}
        empty="No income posted for this period."
      />
      <div className="flex flex-wrap justify-end gap-6 text-right text-sm font-semibold text-slate-900">
        <span>Income Sub-Total: {reportMoney(summary.incomeSubTotal, currency)}</span>
        <span>Income Sub-Total (USD): {reportMoney(summary.incomeSubTotalUSD, "USD")}</span>
        {showBDT ? <span>Income Sub-Total (BDT): {reportMoney(summary.incomeSubTotalBDT, "BDT")}</span> : null}
      </div>

      <ReportTable
        title="Direct Expenses"
        headers={headers}
        rows={directExpenseRows}
        empty="No direct expenses posted for this period."
      />
      <div className="flex flex-wrap justify-end gap-6 text-right text-sm font-semibold text-slate-900">
        <span>Direct Expenses Sub-Total: {reportMoney(summary.directExpenseTotal, currency)}</span>
        <span>Direct Expenses Sub-Total (USD): {reportMoney(summary.directExpenseTotalUSD, "USD")}</span>
        {showBDT ? <span>Direct Expenses Sub-Total (BDT): {reportMoney(summary.directExpenseTotalBDT, "BDT")}</span> : null}
      </div>
      <div className="flex flex-wrap justify-between gap-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-right text-base font-bold text-emerald-900">
        <span>Total Gross Profit: {reportMoney(summary.grossProfit, currency)}</span>
        <span>{reportMoney(summary.grossProfitUSD, "USD")}</span>
        {showBDT ? <span>{reportMoney(summary.grossProfitBDT, "BDT")}</span> : null}
      </div>

      <ReportTable
        title="Indirect Expenses"
        headers={headers}
        rows={indirectExpenseRows}
        empty="No indirect expenses posted for this period."
      />
      <div className="flex flex-wrap justify-end gap-6 text-right text-sm font-semibold text-slate-900">
        <span>Indirect Expenses Sub-Total: {reportMoney(summary.indirectExpenseTotal, currency)}</span>
        <span>Indirect Expenses Sub-Total (USD): {reportMoney(summary.indirectExpenseTotalUSD, "USD")}</span>
        {showBDT ? <span>Indirect Expenses Sub-Total (BDT): {reportMoney(summary.indirectExpenseTotalBDT, "BDT")}</span> : null}
      </div>
      <div className="flex flex-wrap justify-between gap-4 rounded-md border border-emerald-300 bg-emerald-100 p-4 text-right text-lg font-bold text-emerald-950">
        <span>Total Net Profit: {reportMoney(summary.netProfit, currency)}</span>
        <span>{reportMoney(summary.netProfitUSD, "USD")}</span>
        {showBDT ? <span>{reportMoney(summary.netProfitBDT, "BDT")}</span> : null}
      </div>
    </main>
  );
}
