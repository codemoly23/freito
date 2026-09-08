"use server";

import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { ensureModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds, getCurrentBranchScope } from "@/lib/access/branch-access";
import { recalculateShipmentWorkflowInternal } from "@/lib/actions/shipment-workflow";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  revalidateAdminPaths,
  successState,
  validationError,
} from "@/lib/actions/helpers";
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { freightdocument_type } from "@/lib/generated/prisma/client";
import {
  sanitizeFileName,
  validateDocumentFile,
} from "@/lib/documents/storage";
import { blobPut } from "@/lib/blob/client";

// Get shipment details with company scope check
async function getShipmentForDocument(shipmentJobId: string, companyId: string, accessibleBranchIds?: string[] | null) {
  const scope = accessibleBranchIds === undefined ? await getCurrentBranchScope(companyId) : accessibleBranchIds;
  return prisma.shipmentjob.findFirst({
    where: {
      id: shipmentJobId,
      companyId,
      deletedAt: null,
      ...branchScopeWhere(scope),
    },
    include: {
      container: {
        where: { deletedAt: null }
      },
      customer: true,
      shipmentcostitem: {
        where: { deletedAt: null }
      },
      quotation_quotation_shipmentJobIdToshipmentjob: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1
      },
      invoice: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1
      },
      // Fetch existing HBL/HAWB documents to auto-populate manifest
      freightdocument: {
        where: {
          deletedAt: null,
          type: { in: ["HBL", "HAWB"] }
        },
        select: {
          id: true,
          type: true,
          documentNo: true,
          status: true,
          documentversion: {
            orderBy: { versionNumber: "desc" },
            take: 1,
            select: { content: true }
          }
        },
        orderBy: { createdAt: "asc" }
      }
    }
  });
}

// Get document with company scope check
async function getDocumentForAction(documentId: string, companyId: string) {
  const scope = await getCurrentBranchScope(companyId);
  return prisma.freightdocument.findFirst({
    where: {
      id: documentId,
      companyId,
      deletedAt: null,
      ...branchScopeWhere(scope),
    },
    include: {
      documentversion: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });
}

async function getDocumentForDelete(documentId: string, companyId: string) {
  const scope = await getCurrentBranchScope(companyId);
  return prisma.freightdocument.findFirst({
    where: {
      id: documentId,
      companyId,
      deletedAt: null,
      ...branchScopeWhere(scope),
    },
    include: {
      documentversion: {
        select: { id: true, versionNumber: true },
        orderBy: { versionNumber: "desc" },
      },
      documentapproval: {
        select: { id: true },
      },
    },
  });
}

// Generate transaction-safe document sequence numbers
export async function getNextDocumentNumber(tx: any, companyId: string, docType: freightdocument_type) {
  const currentYear = new Date().getFullYear();
  let prefix = "";
  switch (docType) {
    case "HBL": prefix = "HBL"; break;
    case "HAWB": prefix = "HAWB"; break;
    case "MANIFEST": prefix = "MAN"; break;
    case "DEBIT_NOTE": prefix = "DN"; break;
    case "SHIPPING_INSTRUCTION": prefix = "SI"; break;
    case "ARRIVAL_NOTICE": prefix = "AN"; break;
    // External document types
    case "MBL": prefix = "MBL"; break;
    case "MAWB": prefix = "MAWB"; break;
    case "BOOKING_CONFIRMATION": prefix = "BKC"; break;
    case "DELIVERY_ORDER": prefix = "DO"; break;
    case "CARRIER_INVOICE": prefix = "CINV"; break;
    case "VENDOR_DEBIT_NOTE": prefix = "VDN"; break;
    case "COMMERCIAL_INVOICE": prefix = "CI"; break;
    case "PACKING_LIST": prefix = "PL"; break;
    case "CERTIFICATE_OF_ORIGIN": prefix = "CO"; break;
    case "MSDS_DG_CERTIFICATE": prefix = "DGC"; break;
    case "INSURANCE_CERTIFICATE": prefix = "INS"; break;
    case "BILL_OF_ENTRY": prefix = "BOE"; break;
    case "EXPORT_DECLARATION": prefix = "EXD"; break;
    case "CUSTOMS_RELEASE": prefix = "CRO"; break;
    case "GATE_PASS": prefix = "GP"; break;
    case "POD": prefix = "POD"; break;
    case "DELIVERY_CHALLAN": prefix = "DC"; break;
    case "WAREHOUSE_RECEIPT": prefix = "WR"; break;
    default: prefix = docType;
  }

  let seq;
  try {
    seq = await tx.freightdocumentsequence.update({
      where: {
        companyId_documentType_year: {
          companyId,
          documentType: docType,
          year: currentYear
        }
      },
      data: {
        currentSequence: { increment: 1 },
        updatedAt: new Date(),
      }
    });
  } catch {
    try {
      seq = await tx.freightdocumentsequence.create({
        data: {
          id: randomUUID(),
          companyId,
          documentType: docType,
          year: currentYear,
          prefix,
          currentSequence: 1,
          padding: 4,
          updatedAt: new Date(),
        }
      });
    } catch {
      seq = await tx.freightdocumentsequence.update({
        where: {
          companyId_documentType_year: {
            companyId,
            documentType: docType,
            year: currentYear
          }
        },
        data: {
          currentSequence: { increment: 1 },
          updatedAt: new Date(),
        }
      });
    }
  }

  const paddedSeq = String(seq.currentSequence).padStart(seq.padding, "0");
  return `${seq.prefix}-${seq.year}-${paddedSeq}`;
}

function getFormattedShipper(shipment: any) {
  return [shipment.shipperName, shipment.shipperAddress].filter(Boolean).join("\n");
}

function getFormattedConsignee(shipment: any) {
  return [
    shipment.consigneeName,
    shipment.consigneeAddress,
    shipment.consigneeBin ? `BIN: ${shipment.consigneeBin}` : null
  ].filter(Boolean).join("\n");
}

function getFormattedNotifyParty(shipment: any) {
  if (
    shipment.notifyPartyName ||
    shipment.notifyPartyAddress ||
    shipment.notifyPartyBin ||
    shipment.consigneeName ||
    shipment.consigneeAddress ||
    shipment.consigneeBin
  ) {
    return [
      shipment.notifyPartyName || "",
      shipment.notifyPartyAddress || "",
      shipment.notifyPartyBin ? `BIN: ${shipment.notifyPartyBin}` : "",
      "",
      shipment.consigneeName || "",
      shipment.consigneeAddress || "",
      shipment.consigneeBin ? `BIN: ${shipment.consigneeBin}` : ""
    ].join("\n");
  }
  return "";
}

// Generate structured default content snapshot for HBL
function buildHblDefaultContent(shipment: any, userId: string) {
  const containerNumbers = (shipment.container || shipment.shipmentcontainer)?.map((c: any) => c.containerNo).filter(Boolean).join(", ") || "";
  const sealNumbers = (shipment.container || shipment.shipmentcontainer)?.map((c: any) => c.sealNo).filter(Boolean).join(", ") || "";

  return {
    documentType: "HBL",
    responsibility: "FORWARDER_GENERATED",
    handlingMode: "GENERATE_IN_SYSTEM",
    visibility: "CLIENT_SAFE",
    clientFields: {
      hblNo: "",
      mblNo: shipment.mblNo || "",
      shipmentJobNo: shipment.jobNo || "",
      preCarriageBy: "",
      transshipmentPort: "",
      shipper: getFormattedShipper(shipment),
      consignee: getFormattedConsignee(shipment),
      notifyParty: getFormattedNotifyParty(shipment),
      placeOfReceipt: shipment.placeOfReceipt || "",
      portOfLoading: shipment.originPort || "",
      portOfDischarge: shipment.destinationPort || "",
      placeOfDelivery: shipment.placeOfDelivery || "",
      finalDestination: shipment.destinationPort || "",
      vessel: shipment.vesselName || "",
      voyage: shipment.voyageNo || "",
      containerNo: containerNumbers,
      sealNo: sealNumbers,
      marksAndNumbers: shipment.marksAndNumbers || "",
      packages: `${shipment.packageCount || 0} ${shipment.packageType || "PKG"}`,
      goodsDescription: shipment.cargoDescription || "",
      hsCode: shipment.hsCode || "",
      grossWeight: shipment.grossWeight ? `${Number(shipment.grossWeight)} KG` : "",
      measurement: shipment.cbm ? `${Number(shipment.cbm)} CBM` : "",
      freightTerm: shipment.tradeTerm || "PREPAID",
      originalBlCount: "3",
      onBoardDate: shipment.actualDeparture ? new Date(shipment.actualDeparture).toISOString().split("T")[0] : "",
      issuePlace: shipment.placeOfReceipt || shipment.originPort || "",
      issueDate: new Date().toISOString().split("T")[0]
    },
    internalFields: {
      generatedFromShipmentId: shipment.id,
      generatedByUserId: userId,
      sourceSnapshotAt: new Date().toISOString()
    }
  };
}

// Generate structured default content snapshot for HAWB
function buildHawbDefaultContent(shipment: any, userId: string) {
  return {
    documentType: "HAWB",
    responsibility: "FORWARDER_GENERATED",
    handlingMode: "GENERATE_IN_SYSTEM",
    visibility: "CLIENT_SAFE",
    clientFields: {
      hawbNo: "",
      mawbNo: shipment.mawbNo || shipment.mblNo || "",
      shipmentJobNo: shipment.jobNo || "",
      shipper: getFormattedShipper(shipment),
      consignee: getFormattedConsignee(shipment),
      notifyParty: getFormattedNotifyParty(shipment),
      airportOfDeparture: shipment.originPort || "",
      airportOfDestination: shipment.destinationPort || "",
      requestedRouting: shipment.destinationPort || "",
      flightNo: shipment.flightNo || "",
      flightDate: shipment.actualDeparture ? new Date(shipment.actualDeparture).toISOString().split("T")[0] : "",
      pieces: shipment.packageCount ? String(shipment.packageCount) : "",
      grossWeight: shipment.grossWeight ? `${Number(shipment.grossWeight)} KG` : "",
      chargeableWeight: shipment.chargeableWeight ? `${Number(shipment.chargeableWeight)} KG` : "",
      dimensions: "",
      commodity: shipment.cargoDescription || "",
      handlingInformation: "",
      declaredValueForCarriage: "NVD",
      declaredValueForCustoms: "NCV",
      freightTerm: shipment.tradeTerm || "PREPAID",
      issuePlace: shipment.placeOfReceipt || shipment.originPort || "",
      issueDate: new Date().toISOString().split("T")[0]
    },
    internalFields: {
      generatedFromShipmentId: shipment.id,
      generatedByUserId: userId,
      sourceSnapshotAt: new Date().toISOString()
    }
  };
}

function buildManifestDefaultContent(shipment: any, userId: string) {
  const isSea = shipment.transportMode === "SEA";

  // Collect related HBL or HAWB documents already created for this shipment
  const relatedDocs: any[] = (shipment.freightdocument || []).filter(
    (d: any) => isSea ? d.type === "HBL" : d.type === "HAWB"
  );

  // Extract reference numbers from the documents (documentNo is the authoritative number)
  const refNumbers: string[] = relatedDocs.map((d: any) => d.documentNo).filter(Boolean);

  // Primary reference number (first doc, or fallback to shipment field)
  const primaryHblNo = refNumbers[0] || (isSea ? (shipment.hblNo || "") : "");
  const primaryHawbNo = refNumbers[0] || (isSea ? "" : (shipment.hawbNo || ""));

  // Build line items from related documents — one per HBL/HAWB
  // Fall back to a single blank row if no docs exist yet
  const lineItems = relatedDocs.length > 0
    ? relatedDocs.map((d: any) => {
        const cf = (d.documentversion?.[0]?.content as any)?.clientFields || {};
        // HBL stores pieces as "packages" (e.g. "8 PKG"), HAWB stores as "pieces"
        const piecesValue = cf.pieces || cf.packages || (shipment.packageCount ? String(shipment.packageCount) : "");
        // HBL uses "goodsDescription", HAWB uses "commodity"
        const commodityValue = cf.goodsDescription || cf.commodity || shipment.cargoDescription || "";
        return {
          hawbNo: isSea ? "" : d.documentNo,
          hblNo: isSea ? d.documentNo : "",
          shipper: cf.shipper ? cf.shipper.split("\n")[0] : (shipment.shipperName || ""),
          consignee: cf.consignee ? cf.consignee.split("\n")[0] : (shipment.consigneeName || ""),
          pieces: piecesValue,
          grossWeight: cf.grossWeight || (shipment.grossWeight ? `${Number(shipment.grossWeight)} KG` : ""),
          chargeableWeight: cf.chargeableWeight || (shipment.chargeableWeight ? `${Number(shipment.chargeableWeight)} KG` : ""),
          commodity: commodityValue,
          destination: isSea
            ? (cf.portOfDischarge || shipment.destinationPort || "")
            : (cf.airportOfDestination || shipment.destinationPort || "")
        };
      })
    : [
        {
          hawbNo: isSea ? "" : (shipment.hawbNo || ""),
          hblNo: isSea ? (shipment.hblNo || "") : "",
          shipper: shipment.shipperName || "",
          consignee: shipment.consigneeName || "",
          pieces: shipment.packageCount ? String(shipment.packageCount) : "",
          grossWeight: shipment.grossWeight ? `${Number(shipment.grossWeight)} KG` : "",
          chargeableWeight: shipment.chargeableWeight ? `${Number(shipment.chargeableWeight)} KG` : "",
          commodity: shipment.cargoDescription || "",
          destination: shipment.destinationPort || ""
        }
      ];

  return {
    documentType: isSea ? "SEA_CARGO_MANIFEST" : "AIR_CARGO_MANIFEST",
    responsibility: "FORWARDER_GENERATED",
    handlingMode: "GENERATE_IN_SYSTEM",
    visibility: "CLIENT_SAFE",
    clientFields: {
      manifestType: isSea ? "SEA" : "AIR",
      manifestNo: "",
      manifestDate: new Date().toISOString().split("T")[0],
      shipmentJobNo: shipment.jobNo || "",
      // Air Manifest Fields (only relevant when manifestType = AIR)
      mawbNo: shipment.mawbNo || "",
      hawbNo: primaryHawbNo,
      airline: shipment.carrierName || shipment.shippingLineOrAirline || "",
      flightNo: shipment.flightNo || "",
      flightDate: shipment.actualDeparture ? new Date(shipment.actualDeparture).toISOString().split("T")[0] : "",
      airportOfDeparture: isSea ? "" : (shipment.originPort || ""),
      airportOfDestination: isSea ? "" : (shipment.destinationPort || ""),
      // Sea Manifest Fields (only relevant when manifestType = SEA)
      mblNo: shipment.mblNo || "",
      hblNo: primaryHblNo,
      vesselName: shipment.vesselName || "",
      voyageNo: shipment.voyageNo || "",
      onBoardDate: shipment.actualDeparture ? new Date(shipment.actualDeparture).toISOString().split("T")[0] : "",
      portOfLoading: isSea ? (shipment.originPort || "") : "",
      portOfDischarge: isSea ? (shipment.destinationPort || "") : "",
      // Shared Fields
      originCountry: shipment.originCountry || "",
      destinationCountry: shipment.destinationCountry || "",
      shipper: getFormattedShipper(shipment),
      consignee: getFormattedConsignee(shipment),
      notifyParty: getFormattedNotifyParty(shipment),
      totalPieces: shipment.packageCount ? String(shipment.packageCount) : "",
      grossWeight: shipment.grossWeight ? `${Number(shipment.grossWeight)} KG` : "",
      chargeableWeight: shipment.chargeableWeight ? `${Number(shipment.chargeableWeight)} KG` : "",
      dimensions: "",
      commodity: shipment.cargoDescription || "",
      hsCode: shipment.hsCode || "",
      marksAndNumbers: shipment.marksAndNumbers || "",
      specialHandlingInformation: "",
      remarks: "",
      lineItems
    },
    internalFields: {
      generatedFromShipmentId: shipment.id,
      generatedByUserId: userId,
      sourceSnapshotAt: new Date().toISOString()
    }
  };
}

// Generate structured default content snapshot for Customer Debit Note
function buildDebitNoteDefaultContent(shipment: any, userId: string) {
  const customer = shipment.customer;
  const customerAddress = customer?.address || "";

  // Get first quotation number if available
  const quotationNo = (shipment.quotation_quotation_shipmentJobIdToshipmentjob || shipment.quotation)?.[0]?.quoteNo || "";
  // Get first invoice number if available
  const invoiceNo = shipment.invoice?.[0]?.invoiceNo || "";

  // Auto-populate sell charges only
  const sellCostItems = (shipment.shipmentcostitem || []).filter(
    (item: any) => Number(item.sellAmount) > 0
  );

  const lineItems = sellCostItems.map((item: any) => {
    const qty = Number(item.quantity) || 1;
    const rate = Number(item.sellRate) || 0;
    const amount = Number(item.sellAmount) || (qty * rate);
    const tax = 0;
    const total = amount;

    return {
      description: item.chargeName || "",
      basis: item.chargeBasis || "",
      quantity: String(qty),
      unitRate: String(rate),
      amount: String(amount),
      currency: String(item.currency),
      tax: String(tax),
      total: String(total)
    };
  });

  if (lineItems.length === 0) {
    lineItems.push({
      description: "",
      basis: "",
      quantity: "",
      unitRate: "",
      amount: "",
      currency: "USD",
      tax: "",
      total: ""
    });
  }

  // Calculate totals
  let subtotalNum = 0;
  lineItems.forEach((li: any) => {
    subtotalNum += Number(li.amount) || 0;
  });

  const currencyCode = lineItems[0]?.currency || "USD";

  return {
    documentType: "CUSTOMER_DEBIT_NOTE",
    responsibility: "FORWARDER_GENERATED",
    handlingMode: "GENERATE_IN_SYSTEM",
    visibility: "CLIENT_SAFE",
    clientFields: {
      debitNoteNo: "",
      debitNoteDate: new Date().toISOString().split("T")[0],
      shipmentJobNo: shipment.jobNo || "",
      customerName: customer?.name || "",
      customerAddress: customerAddress,
      attention: "",
      referenceNo: shipment.bookingNo || "",
      quotationNo: quotationNo,
      invoiceNo: invoiceNo,
      hblNo: shipment.hblNo || "",
      hawbNo: shipment.hawbNo || "",
      manifestNo: "",
      origin: shipment.originPort || "",
      destination: shipment.destinationPort || "",
      transportMode: shipment.transportMode || "",
      shipmentType: shipment.shipmentType || "",
      currency: currencyCode,
      paymentTerms: "Net 30",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      lineItems: lineItems,
      subtotal: String(subtotalNum),
      taxTotal: "0",
      discount: "0",
      grandTotal: String(subtotalNum),
      amountInWords: "",
      remarks: "",
      paymentInstruction: "Please remittance to our bank account referencing Debit Note number."
    },
    internalFields: {
      generatedFromShipmentId: shipment.id,
      generatedByUserId: userId,
      sourceSnapshotAt: new Date().toISOString(),
      internalBillingReferenceId: ""
    }
  };
}

// Map shipment data to document content snapshot
function buildDefaultDocumentContent(shipment: any) {
  return {
    shipper: {
      name: shipment.shipperName || "",
      address: "",
    },
    consignee: {
      name: shipment.consigneeName || "",
      address: "",
    },
    notifyParty: {
      name: shipment.notifyParty || "",
      address: "",
    },
    vessel: shipment.vesselName || "",
    voyage: shipment.voyageNo || "",
    flightNo: shipment.flightNo || "",
    carrier: shipment.carrierName || shipment.shippingLineOrAirline || "",
    placeOfReceipt: shipment.placeOfReceipt || "",
    portOfLoading: shipment.originPort || "",
    portOfDischarge: shipment.destinationPort || "",
    placeOfDelivery: shipment.placeOfDelivery || "",
    marksAndNumbers: shipment.marksAndNumbers || "",
    cargoDescription: shipment.cargoDescription || "",
    packageCount: shipment.packageCount || 0,
    packageType: shipment.packageType || "",
    grossWeight: shipment.grossWeight ? Number(shipment.grossWeight) : 0,
    netWeight: shipment.netWeight ? Number(shipment.netWeight) : 0,
    cbm: shipment.cbm ? Number(shipment.cbm) : 0,
    freightTerms: shipment.tradeTerm || "PREPAID",
    charges: [],
  };
}

// Create a new freight document (HBL, HAWB, MANIFEST, DEBIT_NOTE, etc.)
export async function createFreightDocument(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  
  const shipmentJobId = getString(formData, "shipmentJobId");
  const typeInput = getString(formData, "type") as freightdocument_type;

  if (!shipmentJobId) return validationError("Shipment ID is required.");
  if (!typeInput) return validationError("Document type is required.");

  const shipment = await getShipmentForDocument(shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment) return validationError("Shipment was not found.");

  const moduleError = await ensureModuleAccess(companyId, "DOCUMENTS");
  if (moduleError) return validationError(moduleError);

  let documentNo = "";

  const document = await prisma.$transaction(async (tx) => {
    if (typeInput === "HBL" || typeInput === "HAWB" || typeInput === "MANIFEST" || typeInput === "DEBIT_NOTE") {
      documentNo = await getNextDocumentNumber(tx, companyId, typeInput);
    } else {
      const count = await tx.freightdocument.count({
        where: { companyId, type: typeInput },
      });
      const sequence = String(count + 1).padStart(4, "0");
      documentNo = `${typeInput}-${shipment.jobNo}-${sequence}`;
    }

    // Prevent duplicate document numbers under the same company and document type
    const exists = await tx.freightdocument.findUnique({
      where: {
        companyId_type_documentNo: {
          companyId,
          type: typeInput,
          documentNo,
        }
      }
    });
    if (exists) {
      throw new Error(`Duplicate document number generated: ${documentNo}`);
    }

    let defaultContent: any;
    const responsibility: any = "FORWARDER_GENERATED";
    const visibility: any = "CLIENT_SAFE";
    const handlingMode: any = "GENERATE_IN_SYSTEM";

    if (typeInput === "HBL") {
      defaultContent = buildHblDefaultContent(shipment, user.id);
      defaultContent.clientFields.hblNo = documentNo;
    } else if (typeInput === "HAWB") {
      defaultContent = buildHawbDefaultContent(shipment, user.id);
      defaultContent.clientFields.hawbNo = documentNo;
    } else if (typeInput === "MANIFEST") {
      defaultContent = buildManifestDefaultContent(shipment, user.id);
      defaultContent.clientFields.manifestNo = documentNo;
    } else if (typeInput === "DEBIT_NOTE") {
      defaultContent = buildDebitNoteDefaultContent(shipment, user.id);
      defaultContent.clientFields.debitNoteNo = documentNo;
    } else {
      defaultContent = buildDefaultDocumentContent(shipment);
    }


    const doc = await tx.freightdocument.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId: shipment.branchId,
        shipmentJobId,
        type: typeInput,
        documentNo,
        status: "DRAFT",
        isClientVisible: false,
        responsibility,
        visibility,
        handlingMode,
        updatedAt: new Date(),
      },
    });

    await tx.documentversion.create({
      data: {
        id: randomUUID(),
        freightDocumentId: doc.id,
        versionNumber: 1,
        content: typeof defaultContent === "string" ? defaultContent : JSON.stringify(defaultContent),
        createdById: user.id,
        remarks: "Initial Generation",
      },
    });

    return doc;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FREIGHT_DOCUMENT_CREATED",
    entityType: "FreightDocument",
    entityId: document.id,
    metadata: {
      shipmentJobId,
      documentNo,
      type: typeInput,
    },
  });

  revalidateAdminPaths();
  return { ok: true, message: `Created ${typeInput} successfully: ${documentNo}` };
}

// Update a freight document's active draft version content
export async function updateFreightDocument(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:manage");

  const documentId = getString(formData, "documentId");
  const contentString = getString(formData, "content");
  const remarks = getString(formData, "remarks") || null;

  if (!documentId) return validationError("Document ID is required.");
  if (!contentString) return validationError("Content is required.");

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return validationError("Document was not found.");

  // SERVER-SIDE LOCK GUARD: Locked documents are immutable.
  // The only way to edit a locked document is to create an amendment via createDocumentAmendment.
  if (doc.status === "LOCKED") {
    return validationError(
      "Locked documents cannot be edited. Create an amendment first."
    );
  }
  if (doc.status === "AMENDED") {
    return validationError(
      "Amended documents cannot be modified. Use the active amendment version."
    );
  }

  let contentObj;
  try {
    contentObj = JSON.parse(contentString);
  } catch {
    return validationError("Invalid JSON content.");
  }

  const latestVersion = doc.documentversion[0];
  if (!latestVersion) {
    return validationError("No active document version found.");
  }

  await prisma.documentversion.update({
    where: { id: latestVersion.id },
    data: {
      content: typeof contentObj === "string" ? contentObj : JSON.stringify(contentObj),
      remarks,
      createdById: user.id,
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FREIGHT_DOCUMENT_UPDATED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      documentNo: doc.documentNo,
      version: latestVersion.versionNumber,
      remarks,
    },
  });

  revalidateAdminPaths();
  return successState("Document updated.");
}

export async function deleteDraftFreightDocument(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const documentId = getString(formData, "documentId");

  if (!documentId) return validationError("Document ID is required.");

  const moduleError = await ensureModuleAccess(companyId, "DOCUMENTS");
  if (moduleError) return validationError(moduleError);

  const doc = await getDocumentForDelete(documentId, companyId);
  if (!doc) return validationError("Document was not found.");

  if (doc.status !== "DRAFT") {
    return validationError("Only draft freight documents can be deleted.");
  }

  if (doc.lockedAt) {
    return validationError("Locked freight documents cannot be deleted.");
  }

  if (doc.isClientVisible) {
    return validationError("Client-visible freight documents cannot be deleted.");
  }

  if (doc.documentapproval.length > 0) {
    return validationError("Documents with approval history cannot be deleted.");
  }

  if (doc.filePath || doc.originalFileName || doc.fileName) {
    return validationError("Uploaded freight documents cannot be deleted from this draft action.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentversion.deleteMany({
      where: { freightDocumentId: doc.id },
    });

    await tx.freightdocument.delete({
      where: { id: doc.id },
    });

    await tx.auditlog.create({
      data: {
        id: randomUUID(),
        companyId,
        actorId: user.id,
        action: "FREIGHT_DOCUMENT_DRAFT_DELETED",
        entityType: "FreightDocument",
        entityId: doc.id,
        metadata: JSON.stringify({
          shipmentJobId: doc.shipmentJobId,
          documentNo: doc.documentNo,
          type: doc.type,
          deletedVersionCount: doc.documentversion.length,
        }),
      },
    });
  });

  revalidateAdminPaths();
  return successState("Draft freight document deleted.");
}

// Submit a freight document for review
export async function submitDocumentForReview(formData: FormData): Promise<ActionState> {
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const documentId = getString(formData, "documentId");

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return validationError("Document was not found.");

  // SERVER-SIDE LOCK GUARD: Locked/approved documents cannot be re-submitted.
  if (doc.status === "LOCKED") {
    return validationError(
      "Locked documents cannot be edited. Create an amendment first."
    );
  }

  if (doc.status !== "DRAFT") return validationError(`Document is already in ${doc.status} state and cannot be submitted.`);

  await prisma.freightdocument.update({
    where: { id: doc.id },
    data: { status: "UNDER_REVIEW", updatedAt: new Date() },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FREIGHT_DOCUMENT_SUBMITTED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      documentNo: doc.documentNo,
    },
  });

  revalidateAdminPaths();
  return successState("Document submitted for review.");
}

// Approve a freight document (internal backoffice approval)
export async function approveFreightDocument(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documents:verify");
  const documentId = getString(formData, "documentId");
  const remarks = getString(formData, "remarks") || null;

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return;

  if (doc.status !== "UNDER_REVIEW") return;

  const latestVersion = doc.documentversion[0];
  if (!latestVersion) return;

  await prisma.$transaction(async (tx) => {
    await tx.freightdocument.update({
      where: { id: doc.id },
      data: { status: "APPROVED", updatedAt: new Date() },
    });

    await tx.documentapproval.create({
      data: {
        id: randomUUID(),
        freightDocumentId: doc.id,
        versionNumber: latestVersion.versionNumber,
        status: "APPROVED",
        approverType: "INTERNAL_USER",
        approvedById: user.id,
        remarks,
        updatedAt: new Date(),
      },
    });
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FREIGHT_DOCUMENT_APPROVED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      documentNo: doc.documentNo,
      version: latestVersion.versionNumber,
      remarks,
    },
  });

  revalidateAdminPaths();
}

// Reject a freight document review request, sending it back to DRAFT state
export async function rejectDocumentReview(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const documentId = getString(formData, "documentId");
  const remarks = getString(formData, "remarks") || null;

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return;

  if (doc.status !== "UNDER_REVIEW" && doc.status !== "APPROVED") return;

  await prisma.freightdocument.update({
    where: { id: doc.id },
    data: { status: "DRAFT", updatedAt: new Date() },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FREIGHT_DOCUMENT_REVIEW_REJECTED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      documentNo: doc.documentNo,
      remarks,
    },
  });

  revalidateAdminPaths();
}

// Lock a freight document (Final Locked - freezing editing)
export async function lockFreightDocument(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documents:verify");
  const documentId = getString(formData, "documentId");

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return;

  if (doc.status !== "APPROVED" && doc.status !== "UNDER_REVIEW" && doc.status !== "DRAFT") {
    // Standard validation: we allow locking if approved or manually triggered
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.freightdocument.update({
      where: { id: doc.id },
      data: {
        status: "LOCKED",
        lockedAt: new Date(),
        lockedById: user.id,
        updatedAt: new Date(),
      },
    });

    // Automatically update relevant number on the ShipmentJob
    if (doc.type === "HBL") {
      await tx.shipmentjob.update({
        where: { id: doc.shipmentJobId },
        data: { hblNo: doc.documentNo, updatedAt: new Date() },
      });
    } else if (doc.type === "HAWB") {
      await tx.shipmentjob.update({
        where: { id: doc.shipmentJobId },
        data: { hawbNo: doc.documentNo, updatedAt: new Date() },
      });
    }

    // Trigger workflow recalculation
    await recalculateShipmentWorkflowInternal(tx, doc.shipmentJobId);
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FREIGHT_DOCUMENT_LOCKED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      documentNo: doc.documentNo,
    },
  });

  revalidateAdminPaths();
}

// Create document amendment (copies locked document version to a new editable version)
export async function createDocumentAmendment(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const documentId = getString(formData, "documentId");
  const remarks = getString(formData, "remarks") || null;

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return;

  if (doc.status !== "LOCKED") return;

  const latestVersion = doc.documentversion[0];
  if (!latestVersion) return;

  await prisma.$transaction(async (tx) => {
    // Update active document status to DRAFT and increment version
    await tx.freightdocument.update({
      where: { id: doc.id },
      data: {
        status: "DRAFT",
        lockedAt: null,
        lockedById: null,
        updatedAt: new Date(),
      },
    });

    await tx.documentversion.create({
      data: {
        id: randomUUID(),
        freightDocumentId: doc.id,
        versionNumber: latestVersion.versionNumber + 1,
        content: typeof latestVersion.content === "string" ? latestVersion.content : JSON.stringify(latestVersion.content),
        createdById: user.id,
        remarks: remarks || `Amendment from v${latestVersion.versionNumber}`,
      },
    });
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FREIGHT_DOCUMENT_AMENDMENT",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      documentNo: doc.documentNo,
      fromVersion: latestVersion.versionNumber,
      remarks,
    },
  });

  revalidateAdminPaths();
}

// Toggle client portal visibility of document
export async function toggleClientVisibility(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const documentId = getString(formData, "documentId");
  const isClientVisible = formData.get("isClientVisible") === "true";

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return;

  await prisma.freightdocument.update({
    where: { id: doc.id },
    data: { isClientVisible, updatedAt: new Date() },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "FREIGHT_DOCUMENT_VISIBILITY_TOGGLED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      documentNo: doc.documentNo,
      isClientVisible,
    },
  });

  revalidateAdminPaths();
}

// ─── External Document Tracker ──────────────────────────────────────────────

// List of internally generated doc types (not external)
const GENERATED_DOC_TYPES = new Set<freightdocument_type>(["HBL", "HAWB", "MANIFEST", "DEBIT_NOTE", "SHIPPING_INSTRUCTION", "ARRIVAL_NOTICE"]);

// Map external doc types to their default responsibility
function getExternalDocResponsibility(docType: freightdocument_type): string {
  switch (docType) {
    case "MBL":
    case "BOOKING_CONFIRMATION":
    case "DELIVERY_ORDER":
    case "CARRIER_INVOICE":
      return "CARRIER_ISSUED";
    case "MAWB":
      return "AIRLINE_ISSUED";
    case "COMMERCIAL_INVOICE":
    case "PACKING_LIST":
    case "CERTIFICATE_OF_ORIGIN":
    case "MSDS_DG_CERTIFICATE":
      return "SHIPPER_PROVIDED";
    case "INSURANCE_CERTIFICATE":
      return "VENDOR_AGENT_ISSUED";
    case "BILL_OF_ENTRY":
    case "EXPORT_DECLARATION":
    case "CUSTOMS_RELEASE":
      return "CUSTOMS_BROKER_PROVIDED";
    case "GATE_PASS":
      return "AUTHORITY_ISSUED";
    case "POD":
    case "DELIVERY_CHALLAN":
    case "WAREHOUSE_RECEIPT":
      return "CARRIER_ISSUED";
    case "VENDOR_DEBIT_NOTE":
      return "VENDOR_AGENT_ISSUED";
    default:
      return "VENDOR_AGENT_ISSUED";
  }
}

// Map external doc types to their default visibility
function getExternalDocVisibility(docType: freightdocument_type): string {
  switch (docType) {
    case "VENDOR_DEBIT_NOTE":
    case "CARRIER_INVOICE":
      return "INTERNAL_ONLY";
    default:
      return "CLIENT_SAFE";
  }
}

// Register a new external document
export async function registerExternalDocument(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });

  const shipmentJobId = getString(formData, "shipmentJobId");
  const typeInput = getString(formData, "type") as freightdocument_type;
  const referenceNo = getString(formData, "referenceNo") || null;
  const issuedBy = getString(formData, "issuedBy") || null;
  const receivedFrom = getString(formData, "receivedFrom") || null;
  const issueDateStr = getString(formData, "issueDate") || null;
  const expiryDateStr = getString(formData, "expiryDate") || null;
  const remarks = getString(formData, "remarks") || null;
  const file = formData.get("file");

  if (!shipmentJobId) return validationError("Shipment ID is required.");
  if (!typeInput) return validationError("Document type is required.");
  if (GENERATED_DOC_TYPES.has(typeInput)) {
    return validationError("Use the Generate Draft form for internally generated document types.");
  }

  const shipment = await getShipmentForDocument(shipmentJobId, companyId, accessibleBranchIds);
  if (!shipment) return validationError("Shipment was not found.");

  const moduleError = await ensureModuleAccess(companyId, "DOCUMENTS");
  if (moduleError) return validationError(moduleError);

  // Handle optional file upload
  let fileData: { fileName: string; originalFileName: string; filePath: string; mimeType: string; fileSize: number } | null = null;
  if (file instanceof File && file.size > 0) {
    const fileError = validateDocumentFile(file);
    if (fileError) return validationError(fileError);

    const safeName = sanitizeFileName(file.name);
    const extension = path.extname(safeName).toLowerCase();
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    const blobName = `uploads/${companyId}/${shipmentJobId}/${storedName}`;
    await blobPut(blobName, await file.arrayBuffer(), file.type || "application/octet-stream");

    fileData = {
      fileName: storedName,
      originalFileName: safeName,
      filePath: blobName,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    };
  }

  const issueDate = issueDateStr ? new Date(issueDateStr) : null;
  const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
  const responsibility = getExternalDocResponsibility(typeInput) as any;
  const visibility = getExternalDocVisibility(typeInput) as any;

  const document = await prisma.$transaction(async (tx) => {
    const documentNo = await getNextDocumentNumber(tx, companyId, typeInput);

    const exists = await tx.freightdocument.findUnique({
      where: {
        companyId_type_documentNo: { companyId, type: typeInput, documentNo },
      },
    });
    if (exists) throw new Error(`Duplicate document number: ${documentNo}`);

    const doc = await tx.freightdocument.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId: shipment.branchId,
        shipmentJobId,
        type: typeInput,
        documentNo,
        status: fileData ? "RECEIVED" : "PENDING_RECEIPT",
        responsibility,
        visibility,
        handlingMode: "RECORD_AND_UPLOAD",
        isClientVisible: false,
        referenceNo,
        issuedBy,
        receivedFrom,
        issueDate,
        expiryDate,
        remarks,
        updatedAt: new Date(),
        ...(fileData ? {
          fileName: fileData.fileName,
          originalFileName: fileData.originalFileName,
          filePath: fileData.filePath,
          mimeType: fileData.mimeType,
          fileSize: fileData.fileSize,
          uploadedById: user.id,
        } : {}),
      },
    });

    // Create initial version record for tracking
    await tx.documentversion.create({
      data: {
        id: randomUUID(),
        freightDocumentId: doc.id,
        versionNumber: 1,
        content: JSON.stringify({
          documentType: typeInput,
          responsibility,
          handlingMode: "RECORD_AND_UPLOAD",
          visibility,
          metadata: {
            referenceNo,
            issuedBy,
            receivedFrom,
            issueDate: issueDateStr,
            expiryDate: expiryDateStr,
            remarks,
            hasFile: !!fileData,
            originalFileName: fileData?.originalFileName || null,
          },
          internalFields: {
            registeredByUserId: user.id,
            registeredAt: new Date().toISOString(),
          },
        }),
        createdById: user.id,
        remarks: "Initial Registration",
      },
    });

    return doc;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "EXTERNAL_DOCUMENT_REGISTERED",
    entityType: "FreightDocument",
    entityId: document.id,
    metadata: {
      shipmentJobId,
      documentNo: document.documentNo,
      type: typeInput,
      referenceNo,
      hasFile: !!fileData,
    },
  });

  revalidateAdminPaths();
  return { ok: true, message: `Registered ${typeInput.replaceAll("_", " ")} successfully: ${document.documentNo}` };
}

// Update an external document's metadata
export async function updateExternalDocument(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:manage");

  const documentId = getString(formData, "documentId");
  const referenceNo = getString(formData, "referenceNo") || null;
  const issuedBy = getString(formData, "issuedBy") || null;
  const receivedFrom = getString(formData, "receivedFrom") || null;
  const issueDateStr = getString(formData, "issueDate") || null;
  const expiryDateStr = getString(formData, "expiryDate") || null;
  const remarks = getString(formData, "remarks") || null;
  const file = formData.get("file");

  if (!documentId) return validationError("Document ID is required.");

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return validationError("Document was not found.");
  if (doc.status === "LOCKED") return validationError("Locked documents cannot be updated. Create an amendment first.");
  if (doc.status === "VERIFIED") return validationError("Verified documents cannot be updated directly.");

  // Handle optional file replacement
  let fileData: { fileName: string; originalFileName: string; filePath: string; mimeType: string; fileSize: number } | null = null;
  if (file instanceof File && file.size > 0) {
    const fileError = validateDocumentFile(file);
    if (fileError) return validationError(fileError);

    const safeName = sanitizeFileName(file.name);
    const extension = path.extname(safeName).toLowerCase();
    const storedName = `${Date.now()}-${randomUUID()}${extension}`;
    const blobName = `uploads/${companyId}/${doc.shipmentJobId}/${storedName}`;
    await blobPut(blobName, await file.arrayBuffer(), file.type || "application/octet-stream");

    fileData = {
      fileName: storedName,
      originalFileName: safeName,
      filePath: blobName,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    };
  }

  const issueDate = issueDateStr ? new Date(issueDateStr) : null;
  const expiryDate = expiryDateStr ? new Date(expiryDateStr) : null;
  const latestVersion = doc.documentversion[0];
  const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  const newStatus = (fileData || doc.filePath) ? "RECEIVED" : doc.status;

  await prisma.$transaction(async (tx) => {
    await tx.freightdocument.update({
      where: { id: doc.id },
      data: {
        referenceNo,
        issuedBy,
        receivedFrom,
        issueDate,
        expiryDate,
        remarks,
        status: newStatus as any,
        updatedAt: new Date(),
        ...(fileData ? {
          fileName: fileData.fileName,
          originalFileName: fileData.originalFileName,
          filePath: fileData.filePath,
          mimeType: fileData.mimeType,
          fileSize: fileData.fileSize,
          uploadedById: user.id,
        } : {}),
      },
    });

    await tx.documentversion.create({
      data: {
        id: randomUUID(),
        freightDocumentId: doc.id,
        versionNumber: nextVersionNumber,
        content: JSON.stringify({
          documentType: doc.type,
          metadata: {
            referenceNo,
            issuedBy,
            receivedFrom,
            issueDate: issueDateStr,
            expiryDate: expiryDateStr,
            remarks,
            hasFile: !!(fileData || doc.filePath),
            originalFileName: fileData?.originalFileName || doc.originalFileName || null,
          },
          internalFields: {
            updatedByUserId: user.id,
            updatedAt: new Date().toISOString(),
          },
        }),
        createdById: user.id,
        remarks: fileData ? "Updated metadata and replaced file" : "Updated metadata",
      },
    });
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "EXTERNAL_DOCUMENT_UPDATED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: {
      documentNo: doc.documentNo,
      type: doc.type,
      referenceNo,
      hasNewFile: !!fileData,
    },
  });

  revalidateAdminPaths();
  return { ok: true, message: `Updated ${doc.type.replaceAll("_", " ")} successfully.` };
}

// Verify an external document
export async function verifyExternalDocument(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const documentId = getString(formData, "documentId");

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return;
  if (doc.status === "VERIFIED" || doc.status === "LOCKED") return;

  await prisma.freightdocument.update({
    where: { id: doc.id },
    data: {
      status: "VERIFIED",
      verifiedById: user.id,
      verifiedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "EXTERNAL_DOCUMENT_VERIFIED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: { documentNo: doc.documentNo, type: doc.type },
  });

  revalidateAdminPaths();
}

// Reject an external document
export async function rejectExternalDocument(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const documentId = getString(formData, "documentId");
  const rejectionReason = getString(formData, "rejectionReason") || null;

  if (!documentId) return validationError("Document ID is required.");

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return validationError("Document was not found.");
  if (doc.status === "LOCKED") return validationError("Locked documents cannot be rejected.");

  await prisma.freightdocument.update({
    where: { id: doc.id },
    data: {
      status: "REJECTED",
      rejectedById: user.id,
      rejectedAt: new Date(),
      rejectionReason,
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "EXTERNAL_DOCUMENT_REJECTED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: { documentNo: doc.documentNo, type: doc.type, rejectionReason },
  });

  revalidateAdminPaths();
  return { ok: true, message: `Rejected ${doc.type.replaceAll("_", " ")}: ${doc.documentNo}` };
}

// Upload file to an existing external document
export async function uploadExternalDocumentFile(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documents:manage");
  const documentId = getString(formData, "documentId");
  const file = formData.get("file");

  if (!documentId) return validationError("Document ID is required.");
  if (!(file instanceof File) || !file.size) return validationError("Select a file to upload.");

  const doc = await getDocumentForAction(documentId, companyId);
  if (!doc) return validationError("Document was not found.");
  if (doc.status === "LOCKED") return validationError("Locked documents cannot be modified.");
  if (doc.status === "VERIFIED") return validationError("Verified documents cannot be modified.");

  const fileError = validateDocumentFile(file);
  if (fileError) return validationError(fileError);

  const safeName = sanitizeFileName(file.name);
  const extension = path.extname(safeName).toLowerCase();
  const storedName = `${Date.now()}-${randomUUID()}${extension}`;
  const blobName = `uploads/${companyId}/${doc.shipmentJobId}/${storedName}`;
  await blobPut(blobName, await file.arrayBuffer(), file.type || "application/octet-stream");

  await prisma.freightdocument.update({
    where: { id: doc.id },
    data: {
      fileName: storedName,
      originalFileName: safeName,
      filePath: blobName,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      uploadedById: user.id,
      status: doc.status === "PENDING_RECEIPT" ? "RECEIVED" : doc.status,
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "EXTERNAL_DOCUMENT_FILE_UPLOADED",
    entityType: "FreightDocument",
    entityId: doc.id,
    metadata: { documentNo: doc.documentNo, originalFileName: safeName },
  });

  revalidateAdminPaths();
  return { ok: true, message: `File uploaded to ${doc.documentNo} successfully.` };
}
