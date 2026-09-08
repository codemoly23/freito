import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { decimalNumber, reportMoney, reportPercent } from "@/lib/reports/formatters";

export default async function CustomersReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { user, companyId } = await requireReportsPage("customers");
  const params = await searchParams;
  const range = getReportDateRange(params);
  const financial = hasPermission(user, "reports:financial");
  const customers = await prisma.customer.findMany({
    where: { companyId, deletedAt: null },
    select: {
      name: true,
      shipmentjob: { where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } }, select: { id: true } },
      quotation: { where: { deletedAt: null, createdAt: { gte: range.from, lte: range.to } }, select: { status: true, totalSellAmount: true } },
      invoice: { where: { deletedAt: null, status: { not: "CANCELLED" }, invoiceDate: { gte: range.from, lte: range.to } }, select: { totalAmount: true, dueAmount: true, exchangeRateToBDT: true } },
    },
  });
  const rows = customers.map((customer) => {
    const quotationTotal = customer.quotation.reduce((sum, quotation) => sum + decimalNumber(quotation.totalSellAmount), 0);
    const accepted = customer.quotation.filter((quotation) => ["ACCEPTED", "CONVERTED"].includes(quotation.status)).length;
    const decided = accepted + customer.quotation.filter((quotation) => ["REJECTED", "EXPIRED"].includes(quotation.status)).length;
    const invoiced = customer.invoice.reduce((sum, invoice) => sum + decimalNumber(invoice.totalAmount) * decimalNumber(invoice.exchangeRateToBDT), 0);
    const receivable = customer.invoice.reduce((sum, invoice) => sum + decimalNumber(invoice.dueAmount) * decimalNumber(invoice.exchangeRateToBDT), 0);
    return { name: customer.name, shipments: customer.shipmentjob.length, quotations: customer.quotation.length, quotationTotal, acceptance: decided ? accepted / decided * 100 : 0, invoiced, receivable };
  });
  const topShipments = [...rows].sort((a, b) => b.shipments - a.shipments);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <ReportHeader title="Customer Report" description="Customer shipment and quotation performance, with finance protected by permission." />
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
