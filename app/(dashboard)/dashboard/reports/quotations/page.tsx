import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import { type ReportSearchParams } from "@/lib/reports/date-range";
import { decimalNumber, reportDate, reportMoney, reportPercent, statusLabel } from "@/lib/reports/formatters";
import {
  getLinkedJob,
  getQuotationsReport,
  quotationModes as modes,
  quotationScopes as scopes,
  quotationShipmentTypes as shipmentTypes,
  quotationStatuses as statuses,
} from "@/lib/reports/quotations-export";

export default async function QuotationsReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { user, companyId } = await requireReportsPage("quotations");
  const params = await searchParams;
  const { quotations, where, range, status, transportMode, shipmentType, serviceScope, customerId } = await getQuotationsReport(params);
  const [customers, groups] = await Promise.all([
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.quotation.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  const count = new Map(groups.map((group) => [group.status, group._count._all]));
  const pending = (count.get("DRAFT") ?? 0) + (count.get("SENT") ?? 0);
  const accepted = (count.get("ACCEPTED") ?? 0) + (count.get("CONVERTED") ?? 0);
  const rejected = count.get("REJECTED") ?? 0;
  const converted = count.get("CONVERTED") ?? 0;
  const decided = accepted + rejected + (count.get("EXPIRED") ?? 0);
  const totalSell = quotations.reduce((sum, quotation) => sum + decimalNumber(quotation.totalSellAmount), 0);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportHeader title="Quotation & Sales Report" description="Sales pipeline, customer quotes, conversion status, and linked job files." />
        {hasPermission(user, "exports:csv") ? (
          <Button asChild size="sm" variant="outline">
            <a
              download
              href={`/api/exports/reports/quotations?from=${range.fromInput}&to=${range.toInput}${status ? `&status=${status}` : ""}${transportMode ? `&transportMode=${transportMode}` : ""}${shipmentType ? `&shipmentType=${shipmentType}` : ""}${serviceScope ? `&serviceScope=${serviceScope}` : ""}${customerId ? `&customerId=${customerId}` : ""}`}
            >
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>
      <ReportFilters from={range.fromInput} to={range.toInput}>
        <select aria-label="Quotation status" name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Customer" name="customerId" defaultValue={customerId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All customers</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select>
        <select aria-label="Transport mode" name="transportMode" defaultValue={transportMode ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All modes</option>{modes.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Shipment type" name="shipmentType" defaultValue={shipmentType ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All shipment types</option>{shipmentTypes.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Service scope" name="serviceScope" defaultValue={serviceScope ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All scopes</option>{scopes.map((value) => <option key={value}>{statusLabel(value)}</option>)}</select>
      </ReportFilters>
      <MetricGrid metrics={[
        { label: "Total quotations", value: quotations.length },
        { label: "Pending quotations", value: pending },
        { label: "Accepted quotations", value: accepted },
        { label: "Rejected quotations", value: rejected },
        { label: "Converted quotations", value: converted },
        { label: "Conversion rate", value: reportPercent(decided ? converted / decided * 100 : 0) },
        { label: "Total quoted sell", value: reportMoney(totalSell) },
      ]} />
      <ReportTable title="Quotation report table" headers={["Quotation No", "Customer", "Status", "Shipment Mode / Type", "Quoted Sell", "Created Date", "Valid Until", "Linked Job / File", "Open Record"]} empty="No quotation records found for the selected filters." rows={quotations.map((quotation) => {
        const linkedJob = getLinkedJob(quotation);
        return [
          quotation.quoteNo,
          quotation.customer.name,
          <Badge variant="secondary" key="status">{statusLabel(quotation.status)}</Badge>,
          `${quotation.transportMode ?? "-"} / ${quotation.shipmentType ?? "-"}`,
          reportMoney(quotation.totalSellAmount),
          reportDate(quotation.createdAt),
          reportDate(quotation.validUntil),
          linkedJob ? <Link className="text-blue-700 hover:underline" href={`/dashboard/shipments/${linkedJob.id}`} key="job">{linkedJob.jobNo}</Link> : "-",
          <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/quotations/${quotation.id}`}>View</Link></Button>,
        ];
      })} />
      <ReportTable title="Accepted but not converted" headers={["Quotation", "Customer", "Quoted Sell", "Valid Until"]} empty="No accepted quotations are waiting for job-file conversion." rows={quotations.filter((quotation) => quotation.status === "ACCEPTED" && !quotation.shipmentjob_quotation_convertedShipmentJobIdToshipmentjob).map((quotation) => [
        quotation.quoteNo,
        quotation.customer.name,
        reportMoney(quotation.totalSellAmount),
        reportDate(quotation.validUntil),
      ])} />
      <ReportTable title="Rejected quotations" headers={["Quotation", "Customer", "Reason", "Created"]} empty="No rejected quotations found for the selected filters." rows={quotations.filter((quotation) => quotation.status === "REJECTED").map((quotation) => [
        quotation.quoteNo,
        quotation.customer.name,
        quotation.shipmentrequest?.rejectionReason ?? "-",
        reportDate(quotation.createdAt),
      ])} />
    </main>
  );
}
