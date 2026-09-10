import { ReportFilters, ReportHeader } from "@/components/reports/report-ui";
import { requireAccountingReportsPage } from "@/lib/reports/access";
import { type ReportSearchParams } from "@/lib/reports/date-range";
import { reportMoney } from "@/lib/reports/formatters";
import { getBalanceSheetSummary } from "@/lib/reports/balance-sheet";
import { hasPermission } from "@/lib/permissions/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BalanceSheetReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const { user } = await requireAccountingReportsPage();
  const params = await searchParams;
  const summary = await getBalanceSheetSummary(params);
  const currency = summary.baseCurrency;
  const showBDT = summary.isAudit && currency !== "BDT";

  return (
    <main className="space-y-6 p-4 lg:p-6">
      {summary.isAudit ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Viewing: {summary.companyName} (audit mode) — this report only, not the rest of your dashboard.
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportHeader
          title="Balance Sheet"
          description={`Assets vs. Liabilities & Equity as of the selected period end. Shown in ${currency} plus USD${showBDT ? " plus BDT" : ""}.`}
        />
        {hasPermission(user, "exports:csv") ? (
          <Button asChild size="sm" variant="outline">
            <a download href={`/api/exports/accounting/balance-sheet?from=${summary.range.fromInput}&to=${summary.range.toInput}`}>
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>
      <ReportFilters from={summary.range.fromInput} to={summary.range.toInput} />
      {!summary.balanced ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Assets ({reportMoney(summary.totalAssets, currency)}) do not match Liabilities &amp; Equity (
          {reportMoney(summary.totalLiabilitiesAndEquity, currency)}).
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.assetGroups.map((group) => (
              <div key={group.groupId}>
                <p className="text-sm font-semibold uppercase tracking-wide text-cyan-800">{group.groupName}</p>
                <div className="mt-1 divide-y divide-slate-100">
                  {group.rows.map((row) => (
                    <div key={row.ledgerAccountId} className="flex justify-between py-1 text-sm">
                      <span className="pl-2">{row.ledgerName}</span>
                      <span className="text-right">
                        {reportMoney(row.debit - row.credit, currency)}
                        <span className="ml-2 text-xs text-slate-500">({reportMoney(row.debitUSD - row.creditUSD, "USD")})</span>
                        {showBDT ? (
                          <span className="ml-2 text-xs text-slate-500">({reportMoney(row.debitBDT - row.creditBDT, "BDT")})</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-medium">
                  <span>Sub Total</span>
                  <span className="text-right">
                    {reportMoney(group.subtotalDebit - group.subtotalCredit, currency)}
                    <span className="ml-2 text-xs text-slate-500">
                      ({reportMoney(group.subtotalDebitUSD - group.subtotalCreditUSD, "USD")})
                    </span>
                    {showBDT ? (
                      <span className="ml-2 text-xs text-slate-500">
                        ({reportMoney(group.subtotalDebitBDT - group.subtotalCreditBDT, "BDT")})
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
            {!summary.assetGroups.length ? (
              <p className="text-sm text-slate-500">No asset activity for this period.</p>
            ) : null}
            <div className="flex justify-between border-t-2 border-slate-300 pt-2 text-base font-bold">
              <span>Total Assets</span>
              <span className="text-right">
                {reportMoney(summary.totalAssets, currency)}
                <span className="ml-2 text-sm text-slate-500">({reportMoney(summary.totalAssetsUSD, "USD")})</span>
                {showBDT ? (
                  <span className="ml-2 text-sm text-slate-500">({reportMoney(summary.totalAssetsBDT, "BDT")})</span>
                ) : null}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Liabilities &amp; Equity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary.liabilityEquityGroups.map((group) => (
              <div key={group.groupId}>
                <p className="text-sm font-semibold uppercase tracking-wide text-cyan-800">{group.groupName}</p>
                <div className="mt-1 divide-y divide-slate-100">
                  {group.rows.map((row) => (
                    <div key={row.ledgerAccountId} className="flex justify-between py-1 text-sm">
                      <span className="pl-2">{row.ledgerName}</span>
                      <span className="text-right">
                        {reportMoney(row.credit - row.debit, currency)}
                        <span className="ml-2 text-xs text-slate-500">({reportMoney(row.creditUSD - row.debitUSD, "USD")})</span>
                        {showBDT ? (
                          <span className="ml-2 text-xs text-slate-500">({reportMoney(row.creditBDT - row.debitBDT, "BDT")})</span>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1 text-sm font-medium">
                  <span>Sub Total</span>
                  <span className="text-right">
                    {reportMoney(group.subtotalCredit - group.subtotalDebit, currency)}
                    <span className="ml-2 text-xs text-slate-500">
                      ({reportMoney(group.subtotalCreditUSD - group.subtotalDebitUSD, "USD")})
                    </span>
                    {showBDT ? (
                      <span className="ml-2 text-xs text-slate-500">
                        ({reportMoney(group.subtotalCreditBDT - group.subtotalDebitBDT, "BDT")})
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-cyan-800">Profit &amp; Loss A/c</p>
              <div className="flex justify-between py-1 text-sm">
                <span className="pl-2">Net Profit</span>
                <span className="text-right">
                  {reportMoney(summary.netProfit, currency)}
                  <span className="ml-2 text-xs text-slate-500">({reportMoney(summary.netProfitUSD, "USD")})</span>
                  {showBDT ? (
                    <span className="ml-2 text-xs text-slate-500">({reportMoney(summary.netProfitBDT, "BDT")})</span>
                  ) : null}
                </span>
              </div>
            </div>
            <div className="flex justify-between border-t-2 border-slate-300 pt-2 text-base font-bold">
              <span>Total</span>
              <span className="text-right">
                {reportMoney(summary.totalLiabilitiesAndEquity, currency)}
                <span className="ml-2 text-sm text-slate-500">({reportMoney(summary.totalLiabilitiesAndEquityUSD, "USD")})</span>
                {showBDT ? (
                  <span className="ml-2 text-sm text-slate-500">({reportMoney(summary.totalLiabilitiesAndEquityBDT, "BDT")})</span>
                ) : null}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
