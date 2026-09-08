import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { decimalNumber, reportDate, reportMoney, reportPercent, statusLabel } from "@/lib/reports/formatters";

const statuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"] as const;
const modes = ["SEA", "AIR", "LAND"] as const;
const shipmentTypes = ["IMPORT", "EXPORT"] as const;
const scopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;

export default async function QuotationsReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { companyId, branchWhere } = await requireReportsPage("quotations");
  const params = await searchParams;
  const range = getReportDateRange(params);
  const status = enumParam(params.status, statuses);
  const transportMode = enumParam(params.transportMode, modes);
  const shipmentType = enumParam(params.shipmentType, shipmentTypes);
  const serviceScope = enumParam(params.serviceScope, scopes);
  const customerId = firstParam(params.customerId);
  const where = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    createdAt: { gte: range.from, lte: range.to },
    ...(status ? { status: status as never } : {}),
    ...(transportMode ? { transportMode: transportMode as never } : {}),
    ...(shipmentType ? { shipmentType: shipmentType as never } : {}),
    ...(customerId ? { customerId } : {}),
    ...(serviceScope ? { OR: [{ shipmentrequest: { serviceScope: serviceScope as never } }, { shipmentjob_quotation_shipmentJobIdToshipmentjob: { serviceScope: serviceScope as never } }] } : {}),
  };
  const [quotations, customers, groups] = await Promise.all([
    prisma.quotation.findMany({
      where,
      select: {
        id: true,
        quoteNo: true,
        status: true,
        shipmentType: true,
        transportMode: true,
        totalSellAmount: true,
        validUntil: true,
        createdAt: true,
        customer: { select: { name: true } },
        shipmentrequest: { select: { serviceScope: true, rejectionReason: true } },
        shipmentjob_quotation_shipmentJobIdToshipmentjob: { select: { id: true, jobNo: true, serviceScope: true } },
        shipmentjob_quotation_convertedShipmentJobIdToshipmentjob: { select: { id: true, jobNo: true, serviceScope: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
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
      <ReportHeader title="Quotation & Sales Report" description="Sales pipeline, customer quotes, conversion status, and linked job files." />
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
        const linkedJob = quotation.shipmentjob_quotation_convertedShipmentJobIdToshipmentjob ?? quotation.shipmentjob_quotation_shipmentJobIdToshipmentjob;
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
