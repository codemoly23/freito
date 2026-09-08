import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { reportDate, statusLabel } from "@/lib/reports/formatters";
import { getDeliveryReleaseSummary } from "@/lib/reports/delivery-summary";

const statuses = ["NOT_STARTED", "IN_PROGRESS", "WAITING", "COMPLETED", "BLOCKED", "CANCELLED"] as const;
const phases = ["ORIGIN", "CARRIER", "DESTINATION", "DELIVERY", "CLOSURE"] as const;
const handlers = ["INTERNAL_EMPLOYEE", "EXTERNAL_AGENT", "VENDOR", "CF_AGENT", "TRUCK_PROVIDER", "DESTINATION_AGENT"] as const;

export default async function WorkflowReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { companyId, branchWhere } = await requireReportsPage("workflow");
  const params = await searchParams;
  const range = getReportDateRange(params);
  const status = enumParam(params.status, statuses);
  const phase = enumParam(params.phase, phases);
  const handlerType = enumParam(params.handlerType, handlers);
  const assignedUserId = firstParam(params.assignedUserId);
  const vendorId = firstParam(params.vendorId);
  const now = new Date();
  const where = {
    companyId,
    deletedAt: null,
    shipmentjob: { deletedAt: null, ...branchWhere },
    createdAt: { gte: range.from, lte: range.to },
    ...(status ? { status: status as never } : {}),
    ...(phase ? { phase: phase as never } : {}),
    ...(handlerType ? { handlerType: handlerType as never } : {}),
    ...(assignedUserId ? { assignedUserId } : {}),
    ...(vendorId ? { vendorId } : {}),
  };
  const [steps, users, vendors, groups, deliverySummary, deliveryShipments] = await Promise.all([
    prisma.shipmentworkflowstep.findMany({
      where,
      select: {
        id: true,
        title: true,
        phase: true,
        status: true,
        handlerType: true,
        dueDate: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        user_shipmentworkflowstep_assignedUserIdTouser: { select: { name: true } },
        vendor: { select: { name: true } },
        shipmentjob: { select: { id: true, jobNo: true, customer: { select: { name: true } } } },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.user.findMany({ where: { companyId, deletedAt: null, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { companyId, deletedAt: null, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.shipmentworkflowstep.groupBy({ by: ["status"], where, _count: { _all: true } }),
    getDeliveryReleaseSummary(params, "workflow"),
    prisma.shipmentjob.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...branchWhere,
        createdAt: { gte: range.from, lte: range.to },
      },
      select: {
        id: true,
        jobNo: true,
        serviceScope: true,
        operationsStatus: true,
        financeCloseStatus: true,
        deliveredAt: true,
        proofOfDeliveryAt: true,
        closedAt: true,
        customer: { select: { name: true } },
        cargoreleasechecklist: {
          select: {
            deliveryOrderReleased: true,
            customsReady: true,
            gatePassNo: true,
            cargoReleased: true,
            cargoReleasedAt: true,
            deliveryDateTime: true,
            outForDeliveryAt: true,
            delivered: true,
            deliveredAt: true,
            verifiedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  const counts = new Map(groups.map((group) => [group.status, group._count._all]));
  const overdue = steps.filter((step) => step.dueDate && step.dueDate < now && !["COMPLETED", "CANCELLED"].includes(step.status));
  const completedDurations = steps.filter((step): step is typeof step & { startedAt: Date; completedAt: Date } => Boolean(step.startedAt && step.completedAt)).map((step) => (step.completedAt.getTime() - step.startedAt.getTime()) / 3_600_000);
  const average = completedDurations.length ? completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length : 0;
  const workflowRows = (items: typeof steps) => items.map((step) => [
    step.shipmentjob.jobNo,
    step.shipmentjob.customer.name,
    step.title,
    step.phase,
    <Badge variant={step.status === "BLOCKED" ? "danger" : "secondary"} key="status">{statusLabel(step.status)}</Badge>,
    reportDate(step.dueDate),
    step.user_shipmentworkflowstep_assignedUserIdTouser?.name ?? step.vendor?.name ?? "Unassigned",
    <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${step.shipmentjob.id}#operations-workflow`}>View</Link></Button>,
  ]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <ReportHeader title="Workflow / Delivery Report" description="Delivery order, gate pass, cargo release, POD, and job closeout progress." />
      <ReportFilters from={range.fromInput} to={range.toInput}>
        <select aria-label="Workflow status" name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Workflow phase" name="phase" defaultValue={phase ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All phases</option>{phases.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Handler type" name="handlerType" defaultValue={handlerType ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All handlers</option>{handlers.map((value) => <option key={value}>{statusLabel(value)}</option>)}</select>
        <select aria-label="Assigned employee" name="assignedUserId" defaultValue={assignedUserId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All employees</option>{users.map((user) => <option value={user.id} key={user.id}>{user.name}</option>)}</select>
        <select aria-label="Vendor" name="vendorId" defaultValue={vendorId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All vendors</option>{vendors.map((vendor) => <option value={vendor.id} key={vendor.id}>{vendor.name}</option>)}</select>
      </ReportFilters>
      <MetricGrid metrics={[
        { label: "Total workflow steps", value: steps.length },
        { label: "Completed steps", value: counts.get("COMPLETED") ?? 0 },
        { label: "Blocked steps", value: counts.get("BLOCKED") ?? 0 },
        { label: "Waiting steps", value: counts.get("WAITING") ?? 0 },
        { label: "Overdue steps", value: overdue.length },
        { label: "Average completion", value: average ? `${average.toFixed(1)} hours` : "-" },
      ]} />
      <MetricGrid metrics={[
        { label: "Delivery Order Pending", value: deliverySummary.deliveryOrderPending },
        { label: "Customs Release Pending", value: deliverySummary.customsReleasePending },
        { label: "Gate Pass Pending", value: deliverySummary.gatePassPending },
        { label: "Cargo Released", value: deliverySummary.cargoReleased },
        { label: "Delivery Scheduled", value: deliverySummary.deliveryScheduled },
        { label: "Out For Delivery", value: deliverySummary.outForDelivery },
        { label: "Delivered", value: deliverySummary.delivered },
        { label: "POD Pending", value: deliverySummary.podPending },
        { label: "POD Verified", value: deliverySummary.podVerified },
        { label: "Job Closed", value: deliverySummary.jobClosed },
      ]} />
      <ReportTable title="Delivery, POD, and closeout table" headers={["Job / File No", "Customer", "Service Scope", "Delivery", "Delivery Order", "Gate Pass", "POD", "Cargo Released Date", "Delivered Date", "Closed Date", "Finance Close", "Open Record"]} empty="No delivery, POD, or closeout records found for this period." rows={deliveryShipments.map((shipment) => {
        const checklist = shipment.cargoreleasechecklist;
        const deliveredDate = shipment.deliveredAt ?? checklist?.deliveredAt ?? null;
        return [
          shipment.jobNo,
          shipment.customer.name,
          statusLabel(shipment.serviceScope),
          checklist?.outForDeliveryAt ? "Out for delivery" : deliveredDate ? "Delivered" : checklist?.deliveryDateTime ? "Scheduled" : "Pending",
          checklist?.deliveryOrderReleased ? "Released" : "Pending",
          checklist?.gatePassNo ? checklist.gatePassNo : "Pending",
          shipment.proofOfDeliveryAt ? "Verified" : deliveredDate ? "Pending" : "-",
          reportDate(checklist?.cargoReleasedAt),
          reportDate(deliveredDate),
          reportDate(shipment.closedAt),
          <Badge variant={shipment.financeCloseStatus === "LOCKED" ? "success" : "secondary"} key="finance">{statusLabel(shipment.financeCloseStatus)}</Badge>,
          <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${shipment.id}`}>View</Link></Button>,
        ];
      })} />
      <ReportTable title="Blocked workflow steps" headers={["Job / File No", "Customer", "Step", "Phase", "Status", "Due", "Handler", "Open Record"]} empty="No blocked workflow steps found for the selected filters." rows={workflowRows(steps.filter((step) => step.status === "BLOCKED"))} />
      <ReportTable title="Overdue workflow steps" headers={["Job / File No", "Customer", "Step", "Phase", "Status", "Due", "Handler", "Open Record"]} empty="No overdue workflow steps found for the selected filters." rows={workflowRows(overdue)} />
      <ReportTable title="Tasks assigned to employees" headers={["Job / File No", "Customer", "Step", "Phase", "Status", "Due", "Handler", "Open Record"]} empty="No employee-assigned workflow tasks found for the selected filters." rows={workflowRows(steps.filter((step) => step.user_shipmentworkflowstep_assignedUserIdTouser))} />
      <ReportTable title="Tasks assigned to vendors / agents" headers={["Job / File No", "Customer", "Step", "Phase", "Status", "Due", "Handler", "Open Record"]} empty="No vendor or agent workflow tasks found for the selected filters." rows={workflowRows(steps.filter((step) => step.vendor))} />
    </main>
  );
}
