import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { type ReportSearchParams } from "@/lib/reports/date-range";
import { reportDate, statusLabel } from "@/lib/reports/formatters";
import { getManagementDashboardSummary } from "@/lib/reports/dashboard-summary";
import { getOperationsShipmentRows } from "@/lib/reports/operations-export";
import { hasPermission } from "@/lib/permissions/rbac";

const modes = ["SEA", "AIR", "LAND"] as const;
const shipmentTypes = ["IMPORT", "EXPORT"] as const;
const loadTypes = ["FCL", "LCL", "AIR_CARGO", "TRUCK"] as const;
const scopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;
const financeStatuses = ["OPEN", "CLOSE_READY", "LOCKED"] as const;

export default async function OperationsReportPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearchParams>;
}) {
  const { companyId, user } = await requireReportsPage("operations");
  const params = await searchParams;
  const {
    shipments,
    shipmentWhere,
    range,
    shipmentType,
    transportMode,
    loadType,
    serviceScope,
    financeCloseStatus,
    customerId,
    currentStatus,
  } = await getOperationsShipmentRows(params);
  const now = new Date();

  const [customers, modeGroups, scopeGroups, delayedSteps, completedSteps, summary] = await Promise.all([
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.shipmentjob.groupBy({ by: ["transportMode"], where: shipmentWhere, _count: { _all: true } }),
    prisma.shipmentjob.groupBy({ by: ["serviceScope"], where: shipmentWhere, _count: { _all: true } }),
    prisma.shipmentworkflowstep.findMany({
      where: { companyId, deletedAt: null, dueDate: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED"] }, shipmentjob: shipmentWhere },
      select: { title: true, status: true, dueDate: true, shipmentjob: { select: { id: true, jobNo: true, customer: { select: { name: true } } } }, user_shipmentworkflowstep_assignedUserIdTouser: { select: { name: true } }, vendor: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 25,
    }),
    prisma.shipmentworkflowstep.findMany({
      where: { companyId, deletedAt: null, status: "COMPLETED", completedAt: { gte: range.from, lte: range.to }, startedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      take: 500,
    }),
    getManagementDashboardSummary(params),
  ]);

  const averageHours = completedSteps.length
    ? completedSteps.reduce((sum, step) => sum + ((step.completedAt?.getTime() ?? 0) - (step.startedAt?.getTime() ?? 0)) / 3_600_000, 0) / completedSteps.length
    : 0;

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ReportHeader title="Operations Report" description="Shipment workload, delay signals, service scope, and finance close readiness." />
        {hasPermission(user, "exports:csv") ? (
          <Button asChild size="sm" variant="outline">
            <a download href={`/api/exports/reports/operations?from=${range.fromInput}&to=${range.toInput}`}>
              Download CSV
            </a>
          </Button>
        ) : null}
      </div>
      <ReportFilters from={range.fromInput} to={range.toInput}>
        <select aria-label="Customer" name="customerId" defaultValue={customerId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All customers</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select>
        <select aria-label="Transport mode" name="transportMode" defaultValue={transportMode ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All modes</option>{modes.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Shipment type" name="shipmentType" defaultValue={shipmentType ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All shipment types</option>{shipmentTypes.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Load type" name="loadType" defaultValue={loadType ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All load types</option>{loadTypes.map((value) => <option key={value}>{statusLabel(value)}</option>)}</select>
        <select aria-label="Service scope" name="serviceScope" defaultValue={serviceScope ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All scopes</option>{scopes.map((value) => <option key={value}>{statusLabel(value)}</option>)}</select>
        <select aria-label="Shipment status" name="status" defaultValue={currentStatus ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All statuses</option>{[...new Set(shipments.map((shipment) => shipment.currentStatus).filter(Boolean))].map((value) => <option key={value ?? ""}>{value}</option>)}</select>
        <select aria-label="Finance close status" name="financeCloseStatus" defaultValue={financeCloseStatus ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All finance statuses</option>{financeStatuses.map((value) => <option key={value}>{statusLabel(value)}</option>)}</select>
      </ReportFilters>
      <MetricGrid metrics={[
        { label: "Total shipments", value: summary.totalShipments },
        { label: "Open jobs", value: summary.openJobs },
        { label: "Closed jobs", value: summary.closedJobs },
        { label: "Active shipments", value: summary.activeShipments },
        { label: "Delayed jobs", value: summary.delayedJobs },
        { label: "Finance close pending", value: summary.financeClosePending },
        { label: "Average step completion", value: averageHours ? `${averageHours.toFixed(1)} hours` : "-" },
      ]} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ReportTable title="Shipments by transport mode" headers={["Mode", "Shipments"]} rows={modeGroups.map((group) => [group.transportMode, group._count._all])} />
        <ReportTable title="Shipments by service scope" headers={["Scope", "Shipments"]} rows={scopeGroups.map((group) => [statusLabel(group.serviceScope), group._count._all])} />
      </div>
      <ReportTable title="Shipment operation table" description="Latest 100 matching shipment job files and their operational status." headers={["Job / File No", "Customer", "Mode", "Shipment Type", "Load Type", "Service Scope", "Status", "ETD / ETA", "Sales Person", "Operation Person", "Finance Close", "Created Date", "Open Record"]} empty="No shipment records found for the selected filters." rows={shipments.map((shipment) => [
        shipment.jobNo,
        shipment.customer.name,
        shipment.transportMode,
        shipment.shipmentType,
        statusLabel(shipment.loadType),
        statusLabel(shipment.serviceScope),
        <Badge variant="secondary" key="status">{shipment.currentStatus ?? "Not set"}</Badge>,
        `${reportDate(shipment.etd)} / ${reportDate(shipment.eta)}`,
        shipment.user_shipmentjob_createdByIdTouser.name,
        shipment.user_shipmentjob_assignedToIdTouser.name,
        <Badge variant={shipment.financeCloseStatus === "LOCKED" ? "success" : "secondary"} key="finance">{statusLabel(shipment.financeCloseStatus)}</Badge>,
        reportDate(shipment.createdAt),
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${shipment.id}`}>View</Link></Button>,
      ])} />
      <ReportTable title="Delayed workflow steps" headers={["Job / File No", "Customer", "Step", "Status", "Due", "Handler", "Open Record"]} empty="No delayed workflow steps found for the selected filters." rows={delayedSteps.map((step) => [
        step.shipmentjob.jobNo,
        step.shipmentjob.customer.name,
        step.title,
        statusLabel(step.status),
        reportDate(step.dueDate),
        step.user_shipmentworkflowstep_assignedUserIdTouser?.name ?? step.vendor?.name ?? "Unassigned",
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${step.shipmentjob.id}#operations-workflow`}>View</Link></Button>,
      ])} />
      <ReportTable title="Awaiting delivery / POD" headers={["Job / File No", "Customer", "ETA", "Delivery", "POD", "Open Record"]} empty="No delivery or POD follow-up records found for this period." rows={shipments.filter((shipment) => !shipment.closedAt && (!shipment.deliveredAt || !shipment.proofOfDeliveryAt)).slice(0, 25).map((shipment) => [
        shipment.jobNo,
        shipment.customer.name,
        reportDate(shipment.eta),
        reportDate(shipment.deliveredAt),
        reportDate(shipment.proofOfDeliveryAt),
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${shipment.id}`}>View</Link></Button>,
      ])} />
      <ReportTable title="Shipments without workflow" headers={["Job / File No", "Customer", "Created", "Open Record"]} empty="No shipment job files are missing workflow steps for the selected filters." rows={shipments.filter((shipment) => shipment._count.shipmentworkflowstep === 0).map((shipment) => [
        shipment.jobNo,
        shipment.customer.name,
        reportDate(shipment.createdAt),
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${shipment.id}`}>View</Link></Button>,
      ])} />
    </main>
  );
}
