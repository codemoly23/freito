import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";

const shipmentTypes = ["IMPORT", "EXPORT"] as const;
const modes = ["SEA", "AIR", "LAND"] as const;
const loadTypes = ["FCL", "LCL", "AIR_CARGO", "TRUCK"] as const;
const scopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;
const financeStatuses = ["OPEN", "CLOSE_READY", "LOCKED"] as const;

/**
 * Shared data-fetch behind the Operations Report's "Shipment operation
 * table" -- used by both the report page (default `limit` of 100, matching
 * the on-screen "Latest 100 matching shipment job files" copy) and the CSV
 * export route (which passes a much higher `limit` so the download isn't
 * truncated the same way the on-screen table is). Keeping exactly one
 * function means the CSV can never drift from what the page shows for the
 * same filters/permissions.
 */
export async function getOperationsShipmentRows(params: ReportSearchParams, limit = 100) {
  const { companyId, branchWhere } = await requireReportsPage("operations");
  const range = getReportDateRange(params);
  const shipmentType = enumParam(params.shipmentType, shipmentTypes);
  const transportMode = enumParam(params.transportMode, modes);
  const loadType = enumParam(params.loadType, loadTypes);
  const serviceScope = enumParam(params.serviceScope, scopes);
  const financeCloseStatus = enumParam(params.financeCloseStatus, financeStatuses);
  const customerId = firstParam(params.customerId);
  const currentStatus = firstParam(params.status);

  const shipmentWhere = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    createdAt: { gte: range.from, lte: range.to },
    ...(shipmentType ? { shipmentType: shipmentType as never } : {}),
    ...(transportMode ? { transportMode: transportMode as never } : {}),
    ...(loadType ? { loadType: loadType as never } : {}),
    ...(serviceScope ? { serviceScope: serviceScope as never } : {}),
    ...(financeCloseStatus ? { financeCloseStatus: financeCloseStatus as never } : {}),
    ...(customerId ? { customerId } : {}),
    ...(currentStatus ? { currentStatus } : {}),
  };

  const shipments = await prisma.shipmentjob.findMany({
    where: shipmentWhere,
    select: {
      id: true,
      jobNo: true,
      currentStatus: true,
      shipmentType: true,
      transportMode: true,
      loadType: true,
      serviceScope: true,
      etd: true,
      eta: true,
      financeCloseStatus: true,
      deliveredAt: true,
      proofOfDeliveryAt: true,
      closedAt: true,
      createdAt: true,
      customer: { select: { name: true } },
      user_shipmentjob_createdByIdTouser: { select: { name: true } },
      user_shipmentjob_assignedToIdTouser: { select: { name: true } },
      _count: { select: { shipmentworkflowstep: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return {
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
  };
}

export type OperationsShipmentRow = Awaited<ReturnType<typeof getOperationsShipmentRows>>["shipments"][number];
