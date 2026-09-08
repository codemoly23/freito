import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { decimalNumber, reportDate, reportMoney, reportPercent, statusLabel } from "@/lib/reports/formatters";
import { getFinanceProfitSummary } from "@/lib/reports/finance-summary";
import { AIProfitInsightsCard } from "@/components/reports/ai-profit-insights-card";
import { AIReportInsightCard } from "@/components/reports/ai-report-insight-card";
import type { ReportInsightMetric } from "@/lib/ai/report-insights";

const financeStatuses = ["OPEN", "CLOSE_READY", "LOCKED"] as const;
const modes = ["SEA", "AIR", "LAND"] as const;
const shipmentTypes = ["IMPORT", "EXPORT"] as const;
const scopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;
const invoiceStatuses = ["DRAFT", "SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
const vendorBillStatuses = ["DRAFT", "RECEIVED", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
const agingBuckets = ["CURRENT", "1_30", "31_60", "61_90", "90_PLUS"] as const;
const profitStatuses = ["PROFITABLE", "LOW_MARGIN", "LOSS_MAKING"] as const;

export default async function FinancialReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { companyId, branchWhere } = await requireReportsPage("financial");
  const params = await searchParams;
  const range = getReportDateRange(params);
  const customerId = firstParam(params.customerId);
  const vendorId = firstParam(params.vendorId);
  const financeCloseStatus = enumParam(params.financeCloseStatus, financeStatuses);
  const transportMode = enumParam(params.transportMode, modes);
  const shipmentType = enumParam(params.shipmentType, shipmentTypes);
  const serviceScope = enumParam(params.serviceScope, scopes);
  const agingBucket = enumParam(params.agingBucket, agingBuckets);
  const profitStatus = enumParam(params.profitStatus, profitStatuses);
  const invoiceStatus = enumParam(params.invoiceStatus, invoiceStatuses);
  const vendorBillStatus = enumParam(params.vendorBillStatus, vendorBillStatuses);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Immediately preceding period of the same length, for the AI insight card.
  const periodLengthMs = range.to.getTime() - range.from.getTime();
  const previousTo = new Date(range.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - periodLengthMs);
  const previousPeriodParams = {
    ...params,
    from: previousFrom.toISOString().slice(0, 10),
    to: previousTo.toISOString().slice(0, 10),
  };

  const shipmentWhere: Prisma.shipmentjobWhereInput = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    createdAt: { gte: range.from, lte: range.to },
    ...(customerId ? { customerId } : {}),
    ...(financeCloseStatus ? { financeCloseStatus: financeCloseStatus as Prisma.shipmentjobWhereInput["financeCloseStatus"] } : {}),
    ...(transportMode ? { transportMode: transportMode as Prisma.shipmentjobWhereInput["transportMode"] } : {}),
    ...(shipmentType ? { shipmentType: shipmentType as Prisma.shipmentjobWhereInput["shipmentType"] } : {}),
    ...(serviceScope ? { serviceScope: serviceScope as Prisma.shipmentjobWhereInput["serviceScope"] } : {}),
  };
  const invoiceWhere: Prisma.invoiceWhereInput = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    invoiceDate: { gte: range.from, lte: range.to },
    status: invoiceStatus
      ? invoiceStatus as Prisma.invoiceWhereInput["status"]
      : { not: "CANCELLED" },
    ...(customerId ? { customerId } : {}),
  };
  const vendorBillWhere: Prisma.vendorbillWhereInput = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    billDate: { gte: range.from, lte: range.to },
    status: vendorBillStatus
      ? vendorBillStatus as Prisma.vendorbillWhereInput["status"]
      : { not: "CANCELLED" },
    ...(vendorId ? { vendorId } : {}),
  };

  const [summary, previousSummary, jobs, invoices, vendorBills, customers, vendors] = await Promise.all([
    getFinanceProfitSummary(params),
    getFinanceProfitSummary(previousPeriodParams),
    prisma.shipmentjob.findMany({
      where: shipmentWhere,
      select: {
        id: true,
        jobNo: true,
        transportMode: true,
        shipmentType: true,
        serviceScope: true,
        operationsStatus: true,
        financeCloseStatus: true,
        financeCloseReadyAt: true,
        financeLockedAt: true,
        allowUnpaidReceivableClose: true,
        vendorPayablesNotApplicable: true,
        totalSellAmount: true,
        totalBuyAmount: true,
        grossProfit: true,
        profitMarginPercent: true,
        finalTotalSellAmount: true,
        finalTotalBuyAmount: true,
        finalGrossProfit: true,
        finalProfitMarginPercent: true,
        deliveredAt: true,
        proofOfDeliveryAt: true,
        customer: { select: { name: true } },
        invoice: { where: { deletedAt: null, status: { not: "CANCELLED" } }, select: { dueAmount: true, exchangeRateToBDT: true } },
        vendorbill: { where: { deletedAt: null, status: { not: "CANCELLED" } }, select: { dueAmount: true, exchangeRateToBDT: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.invoice.findMany({
      where: invoiceWhere,
      select: {
        id: true,
        invoiceNo: true,
        status: true,
        invoiceDate: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
        exchangeRateToBDT: true,
        customer: { select: { name: true } },
        shipmentjob: { select: { id: true, jobNo: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 500,
    }),
    prisma.vendorbill.findMany({
      where: vendorBillWhere,
      select: {
        id: true,
        billNo: true,
        status: true,
        billDate: true,
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
        dueAmount: true,
        exchangeRateToBDT: true,
        vendor: { select: { name: true } },
        shipmentjob: { select: { id: true, jobNo: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 500,
    }),
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const bdt = (row: { exchangeRateToBDT: unknown }, value: unknown) => decimalNumber(value) * decimalNumber(row.exchangeRateToBDT);
  const bucketFor = (dueDate: Date | null, fallbackDate: Date) => {
    const base = dueDate ?? fallbackDate; // TODO: Prefer due date once all legacy records have one.
    const days = Math.floor((today.getTime() - new Date(base).setHours(0, 0, 0, 0)) / 86_400_000);
    if (days <= 0) return "CURRENT";
    if (days <= 30) return "1_30";
    if (days <= 60) return "31_60";
    if (days <= 90) return "61_90";
    return "90_PLUS";
  };
  const bucketLabel = (bucket: string) => ({
    CURRENT: "Current / Not Due",
    "1_30": "1-30 Days",
    "31_60": "31-60 Days",
    "61_90": "61-90 Days",
    "90_PLUS": "90+ Days",
  }[bucket] ?? bucket);
  const moneyByBucket = <T extends { dueAmount: unknown; exchangeRateToBDT: unknown; dueDate: Date | null }>(
    rows: T[],
    date: (row: T) => Date,
  ) => agingBuckets.reduce<Record<string, number>>((totals, bucket) => {
    totals[bucket] = rows
      .filter((row) => bucketFor(row.dueDate, date(row)) === bucket)
      .reduce((sum, row) => sum + bdt(row, row.dueAmount), 0);
    return totals;
  }, {});
  const invoiceAging = moneyByBucket(invoices, (invoice) => invoice.invoiceDate);
  const payableAging = moneyByBucket(vendorBills, (bill) => bill.billDate);
  const filteredInvoices = agingBucket ? invoices.filter((invoice) => bucketFor(invoice.dueDate, invoice.invoiceDate) === agingBucket) : invoices;
  const filteredVendorBills = agingBucket ? vendorBills.filter((bill) => bucketFor(bill.dueDate, bill.billDate) === agingBucket) : vendorBills;
  const filteredJobs = jobs.filter((job) => {
    const profit = job.financeCloseStatus === "LOCKED" ? decimalNumber(job.finalGrossProfit) : decimalNumber(job.grossProfit);
    const margin = job.financeCloseStatus === "LOCKED" ? decimalNumber(job.finalProfitMarginPercent) : decimalNumber(job.profitMarginPercent);
    if (profitStatus === "PROFITABLE") return profit > 0 && margin >= 10;
    if (profitStatus === "LOW_MARGIN") return profit > 0 && margin < 10;
    if (profitStatus === "LOSS_MAKING") return profit < 0;
    return true;
  });
  const outstandingFor = (rows: { dueAmount: unknown; exchangeRateToBDT: unknown }[]) => rows.reduce((sum, row) => sum + bdt(row, row.dueAmount), 0);

  const reportInsightMetrics: ReportInsightMetric[] = [
    { label: "Total Sell", current: summary.totalSell, previous: previousSummary.totalSell, format: "money" },
    { label: "Total Buy", current: summary.totalBuy, previous: previousSummary.totalBuy, format: "money" },
    { label: "Gross Profit", current: summary.grossProfit, previous: previousSummary.grossProfit, format: "money" },
    { label: "Profit Margin", current: summary.profitMarginPercent, previous: previousSummary.profitMarginPercent, format: "percent" },
    { label: "Pending Receivable", current: summary.receivableOutstanding, previous: previousSummary.receivableOutstanding, format: "money" },
    { label: "Pending Payable", current: summary.payableOutstanding, previous: previousSummary.payableOutstanding, format: "money" },
    { label: "Low-margin Jobs", current: summary.lowMarginJobCount, previous: previousSummary.lowMarginJobCount, format: "count" },
    { label: "Loss-making Jobs", current: summary.lossMakingJobCount, previous: previousSummary.lossMakingJobCount, format: "count" },
  ];

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <ReportHeader title="Financial Report" description="Receivable, payable, final profit, and finance closeout overview." />
      <ReportFilters from={range.fromInput} to={range.toInput}>
        <select aria-label="Customer" name="customerId" defaultValue={customerId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All customers</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select>
        <select aria-label="Vendor" name="vendorId" defaultValue={vendorId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All vendors</option>{vendors.map((vendor) => <option value={vendor.id} key={vendor.id}>{vendor.name}</option>)}</select>
        <select aria-label="Finance close status" name="financeCloseStatus" defaultValue={financeCloseStatus ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All finance statuses</option>{financeStatuses.map((value) => <option key={value}>{statusLabel(value)}</option>)}</select>
        <select aria-label="Transport mode" name="transportMode" defaultValue={transportMode ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All modes</option>{modes.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Shipment type" name="shipmentType" defaultValue={shipmentType ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All shipment types</option>{shipmentTypes.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Service scope" name="serviceScope" defaultValue={serviceScope ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All scopes</option>{scopes.map((value) => <option key={value}>{statusLabel(value)}</option>)}</select>
        <select aria-label="Aging bucket" name="agingBucket" defaultValue={agingBucket ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All aging buckets</option>{agingBuckets.map((value) => <option value={value} key={value}>{bucketLabel(value)}</option>)}</select>
        <select aria-label="Profit status" name="profitStatus" defaultValue={profitStatus ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All profit statuses</option>{profitStatuses.map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select>
        <select aria-label="Invoice status" name="invoiceStatus" defaultValue={invoiceStatus ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All invoice statuses</option>{invoiceStatuses.map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select>
        <select aria-label="Vendor bill status" name="vendorBillStatus" defaultValue={vendorBillStatus ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All bill statuses</option>{vendorBillStatuses.map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}</select>
      </ReportFilters>
      <AIReportInsightCard
        reportName="Financial Report"
        periodLabel={`${range.fromInput} to ${range.toInput}`}
        metrics={reportInsightMetrics}
      />
      <MetricGrid metrics={[
        { label: "Total Sell", value: reportMoney(summary.totalSell) },
        { label: "Total Buy", value: reportMoney(summary.totalBuy) },
        { label: "Gross profit", value: reportMoney(summary.grossProfit) },
        { label: "Profit Margin %", value: reportPercent(summary.profitMarginPercent) },
        { label: "Final Sell", value: reportMoney(summary.finalSell) },
        { label: "Final Buy", value: reportMoney(summary.finalBuy) },
        { label: "Final Gross Profit", value: reportMoney(summary.finalGrossProfit) },
        { label: "Final Profit Margin %", value: reportPercent(summary.finalProfitMarginPercent) },
        { label: "Pending Receivable", value: reportMoney(summary.receivableOutstanding) },
        { label: "Pending Payable", value: reportMoney(summary.payableOutstanding) },
        { label: "Finance Locked Jobs", value: summary.lockedJobCount },
        { label: "Close Ready Jobs", value: summary.closeReadyJobCount },
        { label: "Finance Open Jobs", value: summary.openFinanceJobCount },
        { label: "Low-margin Jobs", value: summary.lowMarginJobCount },
        { label: "Loss-making Jobs", value: summary.lossMakingJobCount },
      ]} />
      <AIProfitInsightsCard />
      <ReportTable title="Job-wise profit report" headers={["Job / File No", "Customer", "Mode", "Shipment Type", "Service Scope", "Current Sell", "Current Buy", "Current Gross Profit", "Current Margin %", "Final Sell", "Final Buy", "Final Gross Profit", "Final Margin %", "Finance Close", "Locked At", "Open Record"]} empty="No finance closeout records found for this period." rows={filteredJobs.map((job) => {
        const isLocked = job.financeCloseStatus === "LOCKED";
        const profit = isLocked ? decimalNumber(job.finalGrossProfit) : decimalNumber(job.grossProfit);
        const margin = isLocked ? decimalNumber(job.finalProfitMarginPercent) : decimalNumber(job.profitMarginPercent);
        return [
          job.jobNo,
          job.customer.name,
          job.transportMode,
          job.shipmentType,
          statusLabel(job.serviceScope),
          reportMoney(job.totalSellAmount),
          reportMoney(job.totalBuyAmount),
          reportMoney(job.grossProfit),
          reportPercent(decimalNumber(job.profitMarginPercent)),
          isLocked ? reportMoney(job.finalTotalSellAmount) : "-",
          isLocked ? reportMoney(job.finalTotalBuyAmount) : "-",
          isLocked ? reportMoney(job.finalGrossProfit) : "-",
          isLocked ? reportPercent(decimalNumber(job.finalProfitMarginPercent)) : "-",
          <Badge variant={isLocked ? "success" : "secondary"} key="status">{statusLabel(job.financeCloseStatus)}{profit < 0 ? " / Loss-making" : margin > 0 && margin < 10 ? " / Low-margin" : ""}</Badge>,
          reportDate(job.financeLockedAt),
          <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${job.id}`}>View</Link></Button>,
        ];
      })} />
      <ReportTable title="Finance closeout report" headers={["Job / File No", "Customer", "Operations Status", "Delivery / POD", "Finance Close", "Close Ready At", "Locked At", "Receivable Outstanding", "Payable Outstanding", "Unpaid Receivable Exception", "Vendor Payables N/A", "Open Record"]} empty="No finance closeout records found for the selected filters." rows={filteredJobs.map((job) => [
        job.jobNo,
        job.customer.name,
        job.operationsStatus ?? "-",
        `${job.deliveredAt ? "Delivered" : "Not delivered"} / ${job.proofOfDeliveryAt ? "POD verified" : "POD pending"}`,
        <Badge variant={job.financeCloseStatus === "LOCKED" ? "success" : "secondary"} key="status">{statusLabel(job.financeCloseStatus)}</Badge>,
        reportDate(job.financeCloseReadyAt),
        reportDate(job.financeLockedAt),
        reportMoney(outstandingFor(job.invoice)),
        reportMoney(outstandingFor(job.vendorbill)),
        job.allowUnpaidReceivableClose ? "Yes" : "No",
        job.vendorPayablesNotApplicable ? "Yes" : "No",
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${job.id}`}>View</Link></Button>,
      ])} />
      <MetricGrid metrics={[
        { label: "Total Receivable Outstanding", value: reportMoney(summary.receivableOutstanding) },
        { label: "Current / Not Due", value: reportMoney(invoiceAging.CURRENT) },
        { label: "1-30 Days", value: reportMoney(invoiceAging["1_30"]) },
        { label: "31-60 Days", value: reportMoney(invoiceAging["31_60"]) },
        { label: "61-90 Days", value: reportMoney(invoiceAging["61_90"]) },
        { label: "90+ Days", value: reportMoney(invoiceAging["90_PLUS"]) },
        { label: "Overdue Invoice Count", value: invoices.filter((invoice) => bucketFor(invoice.dueDate, invoice.invoiceDate) !== "CURRENT" && decimalNumber(invoice.dueAmount) > 0).length },
      ]} />
      <ReportTable title="Receivable aging report" headers={["Invoice No", "Customer", "Job / File No", "Invoice Date", "Due Date", "Invoice Amount", "Paid Amount", "Outstanding Amount", "Aging Bucket", "Status", "Open Record"]} empty="No receivable records found for the selected filters." rows={filteredInvoices.map((invoice) => [
        invoice.invoiceNo,
        invoice.customer.name,
        invoice.shipmentjob ? <Link className="text-blue-700 hover:underline" href={`/dashboard/shipments/${invoice.shipmentjob.id}`} key="job">{invoice.shipmentjob.jobNo}</Link> : "-",
        reportDate(invoice.invoiceDate),
        reportDate(invoice.dueDate),
        reportMoney(bdt(invoice, invoice.totalAmount)),
        reportMoney(bdt(invoice, invoice.paidAmount)),
        reportMoney(bdt(invoice, invoice.dueAmount)),
        bucketLabel(bucketFor(invoice.dueDate, invoice.invoiceDate)),
        <Badge variant="secondary" key="status">{statusLabel(invoice.status)}</Badge>,
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/invoices/${invoice.id}`}>View</Link></Button>,
      ])} />
      <MetricGrid metrics={[
        { label: "Total Payable Outstanding", value: reportMoney(summary.payableOutstanding) },
        { label: "Current / Not Due", value: reportMoney(payableAging.CURRENT) },
        { label: "1-30 Days", value: reportMoney(payableAging["1_30"]) },
        { label: "31-60 Days", value: reportMoney(payableAging["31_60"]) },
        { label: "61-90 Days", value: reportMoney(payableAging["61_90"]) },
        { label: "90+ Days", value: reportMoney(payableAging["90_PLUS"]) },
        { label: "Overdue Vendor Bill Count", value: vendorBills.filter((bill) => bucketFor(bill.dueDate, bill.billDate) !== "CURRENT" && decimalNumber(bill.dueAmount) > 0).length },
      ]} />
      <ReportTable title="Payable aging report" headers={["Vendor Bill No", "Vendor", "Job / File No", "Bill Date", "Due Date", "Bill Amount", "Paid Amount", "Outstanding Amount", "Aging Bucket", "Status", "Open Record"]} empty="No payable records found for the selected filters." rows={filteredVendorBills.map((bill) => [
        bill.billNo,
        bill.vendor.name,
        bill.shipmentjob ? <Link className="text-blue-700 hover:underline" href={`/dashboard/shipments/${bill.shipmentjob.id}`} key="job">{bill.shipmentjob.jobNo}</Link> : "-",
        reportDate(bill.billDate),
        reportDate(bill.dueDate),
        reportMoney(bdt(bill, bill.totalAmount)),
        reportMoney(bdt(bill, bill.paidAmount)),
        reportMoney(bdt(bill, bill.dueAmount)),
        bucketLabel(bucketFor(bill.dueDate, bill.billDate)),
        <Badge variant="secondary" key="status">{statusLabel(bill.status)}</Badge>,
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/vendor-bills/${bill.id}`}>View</Link></Button>,
      ])} />
    </main>
  );
}
