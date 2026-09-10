import "server-only";
import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";

export const quotationStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"] as const;
export const quotationModes = ["SEA", "AIR", "LAND"] as const;
export const quotationShipmentTypes = ["IMPORT", "EXPORT"] as const;
export const quotationScopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;

/**
 * Single source of truth for the Quotation & Sales Report's underlying data
 * set: builds the same filtered `where` and runs the same `quotation` query
 * the report page's "Quotation report table" displays. Both the page
 * (take: 100) and the CSV export route (a much higher limit) call this, so
 * the download can never drift from what's on screen.
 * `requireReportsPage("quotations")` performs the report-section permission
 * check and redirects on failure, exactly like the page's own guard.
 */
export async function getQuotationsReport(params: ReportSearchParams, limit = 100) {
  const { companyId, branchWhere } = await requireReportsPage("quotations");
  const range = getReportDateRange(params);
  const status = enumParam(params.status, quotationStatuses);
  const transportMode = enumParam(params.transportMode, quotationModes);
  const shipmentType = enumParam(params.shipmentType, quotationShipmentTypes);
  const serviceScope = enumParam(params.serviceScope, quotationScopes);
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
    ...(serviceScope
      ? {
          OR: [
            { shipmentrequest: { serviceScope: serviceScope as never } },
            { shipmentjob_quotation_shipmentJobIdToshipmentjob: { serviceScope: serviceScope as never } },
          ],
        }
      : {}),
  };
  const quotations = await prisma.quotation.findMany({
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
    take: limit,
  });

  return { quotations, where, range, companyId, status, transportMode, shipmentType, serviceScope, customerId };
}

export type QuotationReportRow = Awaited<ReturnType<typeof getQuotationsReport>>["quotations"][number];

/** Same linked-job derivation the page uses for the "Linked Job / File" column. */
export function getLinkedJob(quotation: QuotationReportRow) {
  return quotation.shipmentjob_quotation_convertedShipmentJobIdToshipmentjob ?? quotation.shipmentjob_quotation_shipmentJobIdToshipmentjob;
}
