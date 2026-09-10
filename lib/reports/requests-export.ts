import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";

export const shipmentRequestStatuses = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "QUOTED",
  "REVISION_REQUESTED",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "CANCELLED",
] as const;
export const shipmentRequestModes = ["SEA", "AIR", "LAND"] as const;
export const shipmentRequestScopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;

/**
 * Single source of truth for the Shipment Request Report's underlying data
 * set: builds the same filtered `where` and runs the same `shipmentrequest`
 * query the report page displays. Both the page (take: 100) and the CSV
 * export route (a much higher limit) call this, so the download can never
 * drift from what's on screen. `requireReportsPage("requests")` performs the
 * report-section permission check and redirects on failure, exactly like the
 * page's own guard -- safe to call again here since Route Handlers fully
 * support `redirect()` too.
 */
export async function getShipmentRequestsReport(params: ReportSearchParams, limit = 100) {
  const { companyId, branchWhere } = await requireReportsPage("requests");
  const range = getReportDateRange(params);
  const status = enumParam(params.status, shipmentRequestStatuses);
  const transportMode = enumParam(params.transportMode, shipmentRequestModes);
  const serviceScope = enumParam(params.serviceScope, shipmentRequestScopes);
  const customerId = firstParam(params.customerId);
  const where = {
    companyId,
    deletedAt: null,
    ...branchWhere,
    createdAt: { gte: range.from, lte: range.to },
    ...(status ? { status: status as never } : {}),
    ...(transportMode ? { transportMode: transportMode as never } : {}),
    ...(serviceScope ? { serviceScope: serviceScope as never } : {}),
    ...(customerId ? { customerId } : {}),
  };
  const requests = await prisma.shipmentrequest.findMany({
    where,
    select: {
      id: true,
      requestNo: true,
      status: true,
      transportMode: true,
      serviceScope: true,
      createdAt: true,
      submittedAt: true,
      quotedAt: true,
      acceptedAt: true,
      convertedAt: true,
      revisionMessage: true,
      customer: { select: { name: true } },
      quotation: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1, select: { totalSellAmount: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return { requests, where, range, companyId, status, transportMode, serviceScope, customerId };
}

export type ShipmentRequestReportRow = Awaited<ReturnType<typeof getShipmentRequestsReport>>["requests"][number];
