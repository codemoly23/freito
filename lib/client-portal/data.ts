import { prisma } from "@/lib/db/prisma";
import type { DocumentChecklistExportData, InvoiceExportData, QuotationExportData, ShipmentExportData } from "@/lib/print/data";
import { getDocumentChecklistExportData, getInvoiceExportData, getQuotationExportData, getShipmentExportData } from "@/lib/print/data";

type PortalScope = { companyId: string; customerId: string; accountId: string };

export async function getPortalQuotationData(id: string, scope: PortalScope): Promise<QuotationExportData | null> {
  const owned = await prisma.quotation.findFirst({
    where: {
      id,
      companyId: scope.companyId,
      customerId: scope.customerId,
      status: { in: ["SENT", "ACCEPTED", "REJECTED", "CONVERTED"] },
      deletedAt: null,
      OR: [
        { shipmentrequest: { clientPortalAccountId: scope.accountId, deletedAt: null } },
        { shipmentjob_quotation_shipmentJobIdToshipmentjob: { shipmentrequest: { clientPortalAccountId: scope.accountId, deletedAt: null } } },
      ],
    },
    select: { id: true },
  });
  return owned ? getQuotationExportData(id, scope.companyId) : null;
}

export async function getPortalInvoiceData(id: string, scope: PortalScope): Promise<InvoiceExportData | null> {
  const owned = await prisma.invoice.findFirst({
    where: { id, companyId: scope.companyId, customerId: scope.customerId, deletedAt: null, status: { not: "CANCELLED" } },
    select: { id: true },
  });
  return owned ? getInvoiceExportData(id, scope.companyId) : null;
}

export async function getPortalShipmentData(id: string, scope: PortalScope): Promise<ShipmentExportData | null> {
  const owned = await prisma.shipmentjob.findFirst({
    where: {
      id,
      companyId: scope.companyId,
      customerId: scope.customerId,
      deletedAt: null,
      shipmentrequest: { clientPortalAccountId: scope.accountId, deletedAt: null },
    },
    select: { id: true },
  });
  return owned ? getShipmentExportData(id, scope.companyId) : null;
}

export async function getPortalDocumentChecklistData(id: string, scope: PortalScope): Promise<DocumentChecklistExportData | null> {
  const shipment = await getPortalShipmentData(id, scope);
  return shipment ? getDocumentChecklistExportData(id, scope.companyId) : null;
}
