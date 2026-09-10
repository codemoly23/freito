import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";

/**
 * Shared data-fetch behind the Workflow / Delivery Report's "Delivery, POD,
 * and closeout table" -- used by both the report page (default `limit` of
 * 100, matching the on-screen table) and the CSV export route (which passes
 * a much higher `limit`). Keeping exactly one function means the CSV can
 * never drift from what the page shows for the same filters/permissions.
 */
export async function getWorkflowDeliveryRows(params: ReportSearchParams, limit = 100) {
  const { companyId, branchWhere } = await requireReportsPage("workflow");
  const range = getReportDateRange(params);

  const deliveryShipments = await prisma.shipmentjob.findMany({
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
    take: limit,
  });

  return { deliveryShipments, range };
}

export type WorkflowDeliveryRow = Awaited<ReturnType<typeof getWorkflowDeliveryRows>>["deliveryShipments"][number];

/**
 * The delivery-status/delivery-order/gate-pass/POD derivation logic for one
 * row of the "Delivery, POD, and closeout table" -- factored out so the
 * report page's on-screen table and the CSV export route derive these
 * display values identically instead of re-implementing the logic twice.
 */
export function deriveDeliveryStatus(shipment: WorkflowDeliveryRow) {
  const checklist = shipment.cargoreleasechecklist;
  const deliveredDate = shipment.deliveredAt ?? checklist?.deliveredAt ?? null;
  return {
    checklist,
    deliveredDate,
    deliveryStatus: checklist?.outForDeliveryAt
      ? "Out for delivery"
      : deliveredDate
        ? "Delivered"
        : checklist?.deliveryDateTime
          ? "Scheduled"
          : "Pending",
    deliveryOrder: checklist?.deliveryOrderReleased ? "Released" : "Pending",
    gatePass: checklist?.gatePassNo ? checklist.gatePassNo : "Pending",
    pod: shipment.proofOfDeliveryAt ? "Verified" : deliveredDate ? "Pending" : "-",
  };
}
