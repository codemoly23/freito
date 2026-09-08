import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { reportDate, reportMoney, reportPercent, statusLabel } from "@/lib/reports/formatters";

const statuses = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "QUOTED", "REVISION_REQUESTED", "ACCEPTED", "REJECTED", "CONVERTED", "CANCELLED"] as const;
const modes = ["SEA", "AIR", "LAND"] as const;
const scopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;

export default async function RequestsReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { companyId, branchWhere } = await requireReportsPage("requests");
  const params = await searchParams;
  const range = getReportDateRange(params);
  const status = enumParam(params.status, statuses);
  const transportMode = enumParam(params.transportMode, modes);
  const serviceScope = enumParam(params.serviceScope, scopes);
  const customerId = firstParam(params.customerId);
  const where = {
    companyId, deletedAt: null, ...branchWhere, createdAt: { gte: range.from, lte: range.to },
    ...(status ? { status: status as never } : {}),
    ...(transportMode ? { transportMode: transportMode as never } : {}),
    ...(serviceScope ? { serviceScope: serviceScope as never } : {}),
    ...(customerId ? { customerId } : {}),
  };
  const [requests, customers, groups] = await Promise.all([
    prisma.shipmentrequest.findMany({
      where,
      select: {
        id: true, requestNo: true, status: true, transportMode: true, serviceScope: true,
        createdAt: true, submittedAt: true, quotedAt: true, acceptedAt: true, convertedAt: true,
        revisionMessage: true, customer: { select: { name: true } },
        quotation: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { totalSellAmount: true } },
      },
      orderBy: { createdAt: "desc" }, take: 100,
    }),
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
      <ReportHeader title="Shipment Request Report" description="Portal and company request pipeline, response time, and conversion performance." />
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
