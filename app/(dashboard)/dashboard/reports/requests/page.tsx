import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import { type ReportSearchParams } from "@/lib/reports/date-range";
import { reportDate, reportMoney, reportPercent, statusLabel } from "@/lib/reports/formatters";
import {
  getShipmentRequestsReport,
  shipmentRequestModes as modes,
  shipmentRequestScopes as scopes,
  shipmentRequestStatuses as statuses,
} from "@/lib/reports/requests-export";

export default async function RequestsReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { user, companyId } = await requireReportsPage("requests");
  const params = await searchParams;
  const { requests, where, range, status, transportMode, serviceScope, customerId } = await getShipmentRequestsReport(params);
  const [customers, groups] = await Promise.all([
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.shipmentrequest.groupBy({ by: ["status"], where, _count: { _all: true } }),
  ]);
  const counts = new Map(groups.map((group) => [group.status, group._count._all]));
  const converted = counts.get("CONVERTED") ?? 0;
  const decisionBase = requests.filter((request) => ["ACCEPTED", "REJECTED", "CONVERTED"].includes(request.status)).length;
  const averageQuoteHours = averageDuration(requests.map((request) => [request.submittedAt, request.quotedAt]));
  const averageConvertHours = averageDuration(requests.map((request) => [request.acceptedAt, request.convertedAt]));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportHeader title="Shipment Request Report" description="Portal and company request pipeline, response time, and conversion performance." />
        {hasPermission(user, "exports:csv") ? (
          <Button asChild size="sm" variant="outline">
            <a
              download
              href={`/api/exports/reports/requests?from=${range.fromInput}&to=${range.toInput}${status ? `&status=${status}` : ""}${transportMode ? `&transportMode=${transportMode}` : ""}${serviceScope ? `&serviceScope=${serviceScope}` : ""}${customerId ? `&customerId=${customerId}` : ""}`}
            >
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>
      <ReportFilters from={range.fromInput} to={range.toInput}>
        <select aria-label="Request status" name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Service scope" name="serviceScope" defaultValue={serviceScope ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All scopes</option>{scopes.map((value) => <option key={value}>{statusLabel(value)}</option>)}</select>
        <select aria-label="Transport mode" name="transportMode" defaultValue={transportMode ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All modes</option>{modes.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Customer" name="customerId" defaultValue={customerId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All customers</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select>
      </ReportFilters>
      <MetricGrid metrics={[
        { label: "Total requests", value: requests.length },
        { label: "Submitted", value: counts.get("SUBMITTED") ?? 0 },
        { label: "Under review", value: counts.get("UNDER_REVIEW") ?? 0 },
        { label: "Quoted", value: counts.get("QUOTED") ?? 0 },
        { label: "Accepted", value: counts.get("ACCEPTED") ?? 0 },
        { label: "Rejected", value: counts.get("REJECTED") ?? 0 },
        { label: "Revision requested", value: counts.get("REVISION_REQUESTED") ?? 0 },
        { label: "Converted", value: converted },
        { label: "Conversion rate", value: reportPercent(decisionBase ? converted / decisionBase * 100 : 0) },
        { label: "Request to quotation", value: averageQuoteHours ? `${averageQuoteHours.toFixed(1)} hours` : "-" },
        { label: "Accepted to shipment", value: averageConvertHours ? `${averageConvertHours.toFixed(1)} hours` : "-" },
      ]} />
      <ReportTable title="Pending requests" headers={["Request", "Customer", "Status", "Mode / Scope", "Created", ""]} rows={requests.filter((request) => ["SUBMITTED", "UNDER_REVIEW", "QUOTED"].includes(request.status)).slice(0, 25).map((request) => [
        request.requestNo, request.customer.name, <Badge variant="warning" key="status">{statusLabel(request.status)}</Badge>,
        `${request.transportMode} / ${statusLabel(request.serviceScope)}`, reportDate(request.createdAt),
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipment-requests/${request.id}`}>View</Link></Button>,
      ])} />
      <ReportTable title="Revision requested" headers={["Request", "Customer", "Revision message", "Created"]} rows={requests.filter((request) => request.status === "REVISION_REQUESTED").map((request) => [
        request.requestNo, request.customer.name, request.revisionMessage ?? "-", reportDate(request.createdAt),
      ])} />
      <ReportTable title="High-value accepted requests" description="Ranked by latest linked quotation sell total." headers={["Request", "Customer", "Status", "Quoted sell amount"]} rows={requests.filter((request) => ["ACCEPTED", "CONVERTED"].includes(request.status) && request.quotation[0]).sort((a, b) => Number(b.quotation[0]?.totalSellAmount ?? 0) - Number(a.quotation[0]?.totalSellAmount ?? 0)).slice(0, 20).map((request) => [
        request.requestNo, request.customer.name, statusLabel(request.status), reportMoney(request.quotation[0]?.totalSellAmount),
      ])} />
    </main>
  );
}

function averageDuration(pairs: [Date | null, Date | null][]) {
  const durations = pairs.filter((pair): pair is [Date, Date] => Boolean(pair[0] && pair[1])).map(([start, end]) => (end.getTime() - start.getTime()) / 3_600_000).filter((duration) => duration >= 0);
  return durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : 0;
}
