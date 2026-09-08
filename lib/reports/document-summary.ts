import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import {
  buildFreightDocumentReportWhere,
  buildShipmentReportWhere,
  parseReportFilters,
} from "@/lib/reports/filters";
import type { DocumentStatusSummary, ReportFilterParams } from "@/lib/reports/types";

const externalDocumentTypes = [
  "MBL",
  "MAWB",
  "BOOKING_CONFIRMATION",
  "DELIVERY_ORDER",
  "CARRIER_INVOICE",
  "VENDOR_DEBIT_NOTE",
  "COMMERCIAL_INVOICE",
  "PACKING_LIST",
  "CERTIFICATE_OF_ORIGIN",
  "MSDS_DG_CERTIFICATE",
  "INSURANCE_CERTIFICATE",
  "BILL_OF_ENTRY",
  "EXPORT_DECLARATION",
  "CUSTOMS_RELEASE",
  "GATE_PASS",
  "POD",
  "DELIVERY_CHALLAN",
  "WAREHOUSE_RECEIPT",
] as const;

export async function getDocumentStatusSummary(
  params: ReportFilterParams = {},
): Promise<DocumentStatusSummary> {
  const { companyId } = await requireReportsPage("documents");
  const filters = parseReportFilters(params);

  const [shipmentDocuments, freightDocuments, shipments, checklist] = await Promise.all([
    prisma.shipmentdocument.findMany({
      where: {
        companyId,
        deletedAt: null,
        createdAt: { gte: filters.from, lte: filters.to },
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.customerId ? { shipmentjob: { customerId: filters.customerId } } : {}),
      },
      select: { status: true },
      take: 2000,
    }),
    prisma.freightdocument.findMany({
      where: buildFreightDocumentReportWhere(companyId, filters),
      select: { type: true, status: true, isClientVisible: true },
      take: 2000,
    }),
    prisma.shipmentjob.findMany({
      where: buildShipmentReportWhere(companyId, filters),
      select: {
        shipmentType: true,
        shipmentdocument: { where: { deletedAt: null }, select: { checklistItemId: true } },
      },
      take: 2000,
    }),
    prisma.documentchecklistitem.findMany({
      where: { isActive: true, isRequired: true, OR: [{ companyId: null }, { companyId }] },
      select: { id: true, category: true },
    }),
  ]);

  const missingDocumentCount = shipments.reduce((sum, shipment) => {
    const present = new Set(shipment.shipmentdocument.map((document) => document.checklistItemId).filter(Boolean));
    const missing = checklist.filter((item) => (
      item.category === shipment.shipmentType || item.category === "COMMON"
    ) && !present.has(item.id));
    return sum + missing.length;
  }, 0);

  return {
    totalDocuments: shipmentDocuments.length + freightDocuments.length,
    verifiedDocuments: shipmentDocuments.filter((document) => document.status === "VERIFIED").length
      + freightDocuments.filter((document) => ["VERIFIED", "LOCKED", "APPROVED"].includes(document.status)).length,
    rejectedDocuments: shipmentDocuments.filter((document) => document.status === "REJECTED").length
      + freightDocuments.filter((document) => document.status === "REJECTED").length,
    clientVisibleDocuments: freightDocuments.filter((document) => document.isClientVisible).length,
    missingDocumentCount,
    hblCount: freightDocuments.filter((document) => document.type === "HBL").length,
    hawbCount: freightDocuments.filter((document) => document.type === "HAWB").length,
    manifestCount: freightDocuments.filter((document) => document.type === "MANIFEST").length,
    customerDebitNoteCount: freightDocuments.filter((document) => document.type === "DEBIT_NOTE").length,
    externalDocumentCount: freightDocuments.filter((document) => externalDocumentTypes.includes(document.type as never)).length,
  };
}
