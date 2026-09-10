import type { ReactNode } from "react";
import { ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { requireAccountingReportsPage } from "@/lib/reports/access";
import { type ReportSearchParams } from "@/lib/reports/date-range";
import { reportMoney } from "@/lib/reports/formatters";
import { getTrialBalanceSummary } from "@/lib/reports/trial-balance";
import { hasPermission } from "@/lib/permissions/rbac";
import { Button } from "@/components/ui/button";

export default async function TrialBalanceReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const { user } = await requireAccountingReportsPage();
  const params = await searchParams;
  const summary = await getTrialBalanceSummary(params);
  const showBDT = summary.isAudit && summary.baseCurrency !== "BDT";

  const headers = ["Particulars", `Debit (${summary.baseCurrency})`, `Credit (${summary.baseCurrency})`, "Debit (USD)", "Credit (USD)"];
  if (showBDT) headers.push("Debit (BDT)", "Credit (BDT)");

  const rows: ReactNode[][] = [];
  for (const group of summary.groups) {
    const headerRow = [
      <span key={`${group.groupId}-header`} className="font-semibold uppercase tracking-wide text-cyan-800">
        {group.groupName}
      </span>,
      "",
      "",
      "",
      "",
    ];
    if (showBDT) headerRow.push("", "");
    rows.push(headerRow);
    for (const row of group.rows) {
      const dataRow = [
        <span key={row.ledgerAccountId} className="pl-4">
          {row.ledgerName}
        </span>,
        row.debit ? reportMoney(row.debit, summary.baseCurrency) : "",
        row.credit ? reportMoney(row.credit, summary.baseCurrency) : "",
        row.debitUSD ? reportMoney(row.debitUSD, "USD") : "",
        row.creditUSD ? reportMoney(row.creditUSD, "USD") : "",
      ];
      if (showBDT) {
        dataRow.push(row.debitBDT ? reportMoney(row.debitBDT, "BDT") : "", row.creditBDT ? reportMoney(row.creditBDT, "BDT") : "");
      }
      rows.push(dataRow);
    }
  }

  return (
    <main className="space-y-6 p-4 lg:p-6">
      {summary.isAudit ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Viewing: {summary.companyName} (audit mode) — this report only, not the rest of your dashboard.
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportHeader
          title="Trial Balance (Ledger Wise)"
          description={`Every ledger's net balance for the selected period, grouped by account type. Shown in ${summary.baseCurrency} plus USD${showBDT ? " plus BDT" : ""}.`}
        />
        {hasPermission(user, "exports:csv") ? (
          <Button asChild size="sm" variant="outline">
            <a download href={`/api/exports/accounting/trial-balance?from=${summary.range.fromInput}&to=${summary.range.toInput}`}>
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>
      <ReportFilters from={summary.range.fromInput} to={summary.range.toInput} />
      {!summary.balanced ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Debit and credit totals do not match — {reportMoney(summary.totalDebit, summary.baseCurrency)} vs{" "}
          {reportMoney(summary.totalCredit, summary.baseCurrency)}. This indicates an unbalanced posting and should
          be investigated.
        </div>
      ) : null}
      <ReportTable
        title="Trial Balance"
        description={`Duration: ${summary.range.fromInput} to ${summary.range.toInput}`}
        headers={headers}
        rows={rows}
      />
      <div className="flex flex-wrap justify-end gap-8 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900">
        <span>Grand Total Debit: {reportMoney(summary.totalDebit, summary.baseCurrency)}</span>
        <span>Grand Total Credit: {reportMoney(summary.totalCredit, summary.baseCurrency)}</span>
        <span>Grand Total Debit (USD): {reportMoney(summary.totalDebitUSD, "USD")}</span>
        <span>Grand Total Credit (USD): {reportMoney(summary.totalCreditUSD, "USD")}</span>
        {showBDT ? (
          <>
            <span>Grand Total Debit (BDT): {reportMoney(summary.totalDebitBDT, "BDT")}</span>
            <span>Grand Total Credit (BDT): {reportMoney(summary.totalCreditBDT, "BDT")}</span>
          </>
        ) : null}
      </div>
    </main>
  );
}
