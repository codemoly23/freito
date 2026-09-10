import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { reportMoney, reportPercent } from "@/lib/reports/formatters";
import { getCustomerPerformanceRows } from "@/lib/reports/customer-summary";

export default async function CustomersReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { user } = await requireReportsPage("customers");
  const params = await searchParams;
  const range = getReportDateRange(params);
  const { rows, financial } = await getCustomerPerformanceRows(params);
  const topShipments = rows;

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportHeader title="Customer Report" description="Customer shipment and quotation performance, with finance protected by permission." />
        {hasPermission(user, "exports:csv") ? (
          <Button asChild size="sm" variant="outline">
            <a download href={`/api/exports/reports/customers?from=${range.fromInput}&to=${range.toInput}`}>
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>
      <ReportFilters from={range.fromInput} to={range.toInput} />
      <MetricGrid metrics={[
        { label: "Active customers", value: rows.length },
        { label: "Customer shipments", value: rows.reduce((sum, row) => sum + row.shipments, 0) },
        { label: "Quoted sell amount", value: reportMoney(rows.reduce((sum, row) => sum + row.quotationTotal, 0)) },
        ...(financial ? [
          { label: "Customer invoiced", value: reportMoney(rows.reduce((sum, row) => sum + row.invoiced, 0)) },
          { label: "Outstanding receivable", value: reportMoney(rows.reduce((sum, row) => sum + row.receivable, 0)) },
        ] : []),
      ]} />
      <ReportTable title="Customer performance" headers={["Customer", "Shipments", "Quotations", "Quoted amount", "Acceptance rate", ...(financial ? ["Invoiced", "Receivable"] : [])]} rows={topShipments.map((row) => [
        row.name, row.shipments, row.quotations, reportMoney(row.quotationTotal), reportPercent(row.acceptance),
        ...(financial ? [reportMoney(row.invoiced), reportMoney(row.receivable)] : []),
      ])} />
    </main>
  );
}
