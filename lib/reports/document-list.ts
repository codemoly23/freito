import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";

const statuses = ["PENDING", "UPLOADED", "VERIFIED", "REJECTED"] as const;

/**
 * Row-level freight document data for the Document Reports page's "Freight
 * document status table". Shared by the page (limit: 100) and the
 * `/api/exports/reports/documents?type=freight` CSV route (limit: 5000) so
 * both always read from the exact same query.
 */
export async function getFreightDocumentReportRows(params: ReportSearchParams, limit = 100) {
  const { companyId, branchWhere } = await requireReportsPage("documents");
  const range = getReportDateRange(params);
  const shipmentJobId = firstParam(params.shipmentJobId);
  const customerId = firstParam(params.customerId);
  return prisma.freightdocument.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...branchWhere,
      createdAt: { gte: range.from, lte: range.to },
      ...(shipmentJobId ? { shipmentJobId } : {}),
      ...(customerId ? { shipmentjob: { customerId } } : {}),
    },
    select: {
      id: true,
      type: true,
      documentNo: true,
      referenceNo: true,
      status: true,
      responsibility: true,
      handlingMode: true,
      isClientVisible: true,
      createdAt: true,
      updatedAt: true,
      shipmentjob: { select: { id: true, jobNo: true, customer: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Row-level shipment document checklist upload data for the Document
 * Reports page's "Shipment document checklist table". Shared by the page
 * (limit: 100) and the `/api/exports/reports/documents?type=checklist` CSV
 * route (limit: 5000).
 */
export async function getShipmentChecklistDocumentReportRows(params: ReportSearchParams, limit = 100) {
  const { companyId, branchWhere } = await requireReportsPage("documents");
  const range = getReportDateRange(params);
  const status = enumParam(params.status, statuses);
  const shipmentJobId = firstParam(params.shipmentJobId);
  const customerId = firstParam(params.customerId);
  return prisma.shipmentdocument.findMany({
    where: {
      companyId,
      deletedAt: null,
      ...branchWhere,
      createdAt: { gte: range.from, lte: range.to },
      ...(status ? { status: status as never } : {}),
      ...(shipmentJobId ? { shipmentJobId } : {}),
      ...(customerId ? { shipmentjob: { customerId } } : {}),
    },
    select: {
      id: true,
      documentName: true,
      documentType: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      remarks: true,
      shipmentjob: { select: { id: true, jobNo: true, shipmentType: true, customer: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
