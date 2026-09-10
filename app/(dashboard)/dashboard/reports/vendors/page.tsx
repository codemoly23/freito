import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { decimalNumber, reportDate, reportMoney, statusLabel } from "@/lib/reports/formatters";
import { getVendorSummaryRows } from "@/lib/reports/vendor-summary";

export default async function VendorsReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { user } = await requireReportsPage("vendors");
  const params = await searchParams;
  const range = getReportDateRange(params);
  const { rows, financial } = await getVendorSummaryRows(params);
  const steps = rows.flatMap((vendor) => vendor.shipmentworkflowstep.map((step) => ({ ...step, vendor: vendor.name })));
  const bills = rows.flatMap((vendor) => vendor.vendorbill.map((bill) => ({ ...bill, vendor: vendor.name, amount: decimalNumber(bill.totalAmount) * decimalNumber(bill.exchangeRateToBDT), due: decimalNumber(bill.dueAmount) * decimalNumber(bill.exchangeRateToBDT) })));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportHeader title="Vendor Report" description="Vendor operational assignments and permission-protected payable summaries." />
        {hasPermission(user, "exports:csv") ? (
          <Button asChild size="sm" variant="outline">
            <a download href={`/api/exports/reports/vendors?from=${range.fromInput}&to=${range.toInput}`}>
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>
      <ReportFilters from={range.fromInput} to={range.toInput} />
      <MetricGrid metrics={[
        { label: "Active vendors", value: rows.length },
        { label: "Vendor workflow steps", value: steps.length },
        ...(financial ? [
          { label: "Vendor bill amount", value: reportMoney(rows.reduce((sum, row) => sum + row.billed, 0)) },
          { label: "Vendor payable due", value: reportMoney(rows.reduce((sum, row) => sum + row.due, 0)) },
        ] : []),
      ]} />
      <ReportTable title="Vendor summary" headers={["Vendor", "Type", "Assigned steps", ...(financial ? ["Bill amount", "Payable due"] : [])]} rows={rows.map((row) => [
        row.name, statusLabel(row.type), row.shipmentworkflowstep.length, ...(financial ? [reportMoney(row.billed), reportMoney(row.due)] : []),
      ])} />
      <ReportTable title="Vendor-assigned operation steps" headers={["Vendor", "Shipment", "Step", "Status", "Due"]} rows={steps.slice(0, 50).map((step) => [
        step.vendor, step.shipmentjob.jobNo, step.title, statusLabel(step.status), reportDate(step.dueDate),
      ])} />
      {financial ? <ReportTable title="Vendor bills" headers={["Vendor", "Bill", "Bill date", "Amount", "Due"]} rows={bills.slice(0, 50).map((bill) => [
        bill.vendor, bill.billNo, reportDate(bill.billDate), reportMoney(bill.amount), reportMoney(bill.due),
      ])} /> : null}
    </main>
  );
}
