import { prisma } from "@/lib/db/prisma";

export async function getQuotationExportData(id: string, companyId: string) {
  const result = await prisma.quotation.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      shipmentRequestId: true,
      quoteNo: true,
      createdAt: true,
      validUntil: true,
      status: true,
      shipmentType: true,
      transportMode: true,
      loadType: true,
      tradeTerm: true,
      originCountry: true,
      originPort: true,
      destinationCountry: true,
      destinationPort: true,
      cargoDescription: true,
      remarks: true,
      totalSellAmount: true,
      templateVersionId: true,
      company: { select: { name: true, legalName: true, email: true, phone: true, address: true, logoPath: true } },
      customer: { select: { name: true, email: true, phone: true, address: true } },
      shipmentjob_quotation_shipmentJobIdToshipmentjob: { select: { jobNo: true } },
      shipmentrequest: { select: { requestNo: true, customerReference: true } },
      user_quotation_createdByIdTouser: { select: { name: true } },
      quotationcharge: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          chargeName: true,
          chargeType: true,
          chargeBasis: true,
          currency: true,
          quantity: true,
          sellRate: true,
          sellAmount: true,
          remarks: true,
        },
      },
    },
  });
  if (!result) return null;
  return {
    ...result,
    shipmentJob: result.shipmentjob_quotation_shipmentJobIdToshipmentjob,
    shipmentRequest: result.shipmentrequest,
    createdBy: result.user_quotation_createdByIdTouser,
    charges: result.quotationcharge,
  };
}

export async function getInvoiceExportData(id: string, companyId: string) {
  const result = await prisma.invoice.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      invoiceNo: true,
      invoiceDate: true,
      dueDate: true,
      status: true,
      currency: true,
      subtotal: true,
      discountAmount: true,
      taxAmount: true,
      totalAmount: true,
      paidAmount: true,
      dueAmount: true,
      remarks: true,
      templateVersionId: true,
      company: { select: { name: true, legalName: true, email: true, phone: true, address: true, logoPath: true } },
      customer: { select: { name: true, email: true, phone: true, address: true, binOrVat: true } },
      shipmentjob: { select: { jobNo: true } },
      quotation: { select: { quoteNo: true } },
      user: { select: { name: true } },
      invoiceline: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { description: true, quantity: true, unitPrice: true, amount: true, remarks: true },
      },
    },
  });
  if (!result) return null;
  return {
    ...result,
    shipmentJob: result.shipmentjob,
    createdBy: result.user,
    lines: result.invoiceline,
  };
}

export async function getShipmentExportData(id: string, companyId: string) {
  const result = await prisma.shipmentjob.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      id: true,
      jobNo: true,
      shipmentType: true,
      transportMode: true,
      loadType: true,
      tradeTerm: true,
      serviceScope: true,
      originCountry: true,
      originPort: true,
      destinationCountry: true,
      destinationPort: true,
      placeOfReceipt: true,
      placeOfDelivery: true,
      pickupAddress: true,
      deliveryAddress: true,
      shipperName: true,
      consigneeName: true,
      notifyParty: true,
      carrierName: true,
      shippingLineOrAirline: true,
      vesselName: true,
      voyageNo: true,
      flightNo: true,
      mblNo: true,
      hblNo: true,
      mawbNo: true,
      hawbNo: true,
      bookingNo: true,
      etd: true,
      eta: true,
      actualDeparture: true,
      actualArrival: true,
      currentStatus: true,
      cargoDescription: true,
      packageCount: true,
      packageType: true,
      grossWeight: true,
      chargeableWeight: true,
      cbm: true,
      company: { select: { name: true, legalName: true, email: true, phone: true, address: true, logoPath: true } },
      customer: { select: { name: true, email: true, phone: true, address: true } },
      container: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { containerNo: true, sealNo: true, containerType: true, packageCount: true, grossWeight: true, cbm: true },
      },
      shipmentworkflowstep: {
        where: { deletedAt: null, visibility: "CUSTOMER_VISIBLE" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { title: true, status: true, dueDate: true, completedAt: true },
      },
      shipmentdocument: {
        where: { deletedAt: null },
        select: { id: true, checklistItemId: true, documentName: true, status: true },
      },
    },
  });
  if (!result) return null;
  return {
    ...result,
    containers: result.container,
    workflowSteps: result.shipmentworkflowstep,
    documents: result.shipmentdocument,
  };
}

export async function getDocumentChecklistExportData(id: string, companyId: string) {
  const shipment = await getShipmentExportData(id, companyId);
  if (!shipment) return null;
  const checklist = await prisma.documentchecklistitem.findMany({
    where: {
      isActive: true,
      OR: [{ companyId: null }, { companyId }],
      category: { in: [shipment.shipmentType, "COMMON"] },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, isRequired: true },
  });
  return {
    shipment,
    items: checklist.map((item) => {
      const document = shipment.documents.find((candidate) => candidate.checklistItemId === item.id);
      return {
        name: item.name,
        description: item.description,
        isRequired: item.isRequired,
        status: document?.status ?? "MISSING",
      };
    }),
  };
}

export type QuotationExportData = NonNullable<Awaited<ReturnType<typeof getQuotationExportData>>>;
export type InvoiceExportData = NonNullable<Awaited<ReturnType<typeof getInvoiceExportData>>>;
export type ShipmentExportData = NonNullable<Awaited<ReturnType<typeof getShipmentExportData>>>;
export type DocumentChecklistExportData = NonNullable<Awaited<ReturnType<typeof getDocumentChecklistExportData>>>;
