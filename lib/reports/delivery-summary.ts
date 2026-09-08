import { prisma } from "@/lib/db/prisma";
import { requireReportsPage, type ReportSection } from "@/lib/reports/access";
import { buildShipmentReportWhere, parseReportFilters } from "@/lib/reports/filters";
import type { DeliveryReleaseSummary, ReportFilterParams } from "@/lib/reports/types";

export async function getDeliveryReleaseSummary(
  params: ReportFilterParams = {},
  section: ReportSection = "operations",
): Promise<DeliveryReleaseSummary> {
  const { companyId, branchWhere } = await requireReportsPage(section);
  const filters = parseReportFilters(params);
  const shipmentWhere = { ...buildShipmentReportWhere(companyId, filters), ...branchWhere };

  const [shipments, checklists] = await Promise.all([
    prisma.shipmentjob.findMany({
      where: shipmentWhere,
      select: {
        closedAt: true,
        deliveredAt: true,
        proofOfDeliveryAt: true,
        operationsStatus: true,
      },
      take: 2000,
    }),
    prisma.cargoreleasechecklist.findMany({
      where: { companyId, shipmentjob: shipmentWhere },
      select: {
        deliveryOrderReleased: true,
        customsReady: true,
        gatePassNo: true,
        cargoReleased: true,
        deliveryDateTime: true,
        outForDeliveryAt: true,
        delivered: true,
        verifiedAt: true,
      },
      take: 2000,
    }),
  ]);

  return {
    deliveryOrderPending: checklists.filter((checklist) => !checklist.deliveryOrderReleased).length,
    customsReleasePending: checklists.filter((checklist) => !checklist.customsReady).length,
    gatePassPending: checklists.filter((checklist) => !checklist.gatePassNo).length,
    cargoReleased: checklists.filter((checklist) => checklist.cargoReleased).length,
    deliveryScheduled: checklists.filter((checklist) => checklist.deliveryDateTime).length,
    outForDelivery: checklists.filter((checklist) => checklist.outForDeliveryAt).length,
    delivered: shipments.filter((shipment) => shipment.deliveredAt).length
      + checklists.filter((checklist) => checklist.delivered).length,
    podPending: shipments.filter((shipment) => shipment.deliveredAt && !shipment.proofOfDeliveryAt).length,
    podVerified: shipments.filter((shipment) => shipment.proofOfDeliveryAt).length
      + checklists.filter((checklist) => checklist.verifiedAt).length,
    jobCloseReady: shipments.filter((shipment) => shipment.operationsStatus === "CLOSE_READY").length,
    jobClosed: shipments.filter((shipment) => shipment.closedAt).length,
  };
}
