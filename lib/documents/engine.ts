import { prisma } from "@/lib/db/prisma";
import { cache } from "react";

export interface ShipmentDetails {
  id: string;
  companyId: string;
  shipmentType: string;
  transportMode: string;
  loadType: string;
  tradeTerm: string | null;
  originCountry: string;
  destinationCountry: string;
  lcRequired: boolean;
  ttRequired: boolean;
  isHazardous: boolean;
  isPerishable: boolean;
  isTemperatureControlled: boolean;
  containersCount: number;
}

// Fetch shipment details with count of containers to avoid loading full container list
export const fetchShipmentDetails = cache(async (shipmentId: string, companyId?: string | null): Promise<ShipmentDetails | null> => {
  const shipment = await prisma.shipmentjob.findFirst({
    where: {
      id: shipmentId,
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    },
    include: {
      _count: {
        select: { container: true }
      }
    }
  });

  if (!shipment) return null;

  return {
    id: shipment.id,
    companyId: shipment.companyId,
    shipmentType: shipment.shipmentType,
    transportMode: shipment.transportMode,
    loadType: shipment.loadType,
    tradeTerm: shipment.tradeTerm,
    originCountry: shipment.originCountry,
    destinationCountry: shipment.destinationCountry,
    lcRequired: shipment.lcRequired,
    ttRequired: shipment.ttRequired,
    isHazardous: shipment.isHazardous,
    isPerishable: shipment.isPerishable,
    isTemperatureControlled: shipment.isTemperatureControlled,
    containersCount: shipment._count.container,
  };
});

// Dynamic Configuration Filter Engine
export const getDynamicChecklistForShipment = cache(async (shipmentId: string, companyId?: string | null) => {
  const shipment = await fetchShipmentDetails(shipmentId, companyId);
  if (!shipment) return [];

  // Query all active document checklist configurations
  const docConfig = await prisma.documentchecklistitem.findMany({
    where: {
      isActive: true,
      OR: [
        { companyId: null },
        { companyId: shipment.companyId },
      ],
    },
    orderBy: { sortOrder: "asc" },
  });

  return docConfig.filter((item) => {
    // 1. Media filter
    if (item.media && item.media !== "COMMON") {
      if (item.media === "IMPORT" && shipment.shipmentType !== "IMPORT") return false;
      if (item.media === "EXPORT" && shipment.shipmentType !== "EXPORT") return false;
    }

    // 2. Transport Mode filter
    if (item.transportMode && item.transportMode !== "MULTIMODAL" && item.transportMode !== "ALL") {
      const modeMap: Record<string, string> = {
        LAND: "ROAD",
        ROAD: "ROAD",
        SEA: "SEA",
        AIR: "AIR",
      };
      const itemMode = modeMap[item.transportMode] || item.transportMode;
      const shipmentMode = modeMap[shipment.transportMode] || shipment.transportMode;
      if (itemMode !== shipmentMode) return false;
    }

    // 3. Country restriction filter (comma-separated, e.g. "BD,US")
    if (item.countryRestriction) {
      const countries = item.countryRestriction.split(",").map(c => c.trim().toUpperCase());
      const originMatch = countries.includes(shipment.originCountry.toUpperCase());
      const destMatch = countries.includes(shipment.destinationCountry.toUpperCase());
      if (!originMatch && !destMatch) return false;
    }

    // 4. Incoterm restriction filter (comma-separated, e.g. "FOB,CIF")
    if (item.incotermRestriction && shipment.tradeTerm) {
      const incoterms = item.incotermRestriction.split(",").map(i => i.trim().toUpperCase());
      if (!incoterms.includes(shipment.tradeTerm.toUpperCase())) return false;
    }

    // 5. LC Requirement filter
    if (item.lcRequired && !shipment.lcRequired) return false;

    // 6. TT Requirement filter
    if (item.ttRequired && !shipment.ttRequired) return false;

    // 7. Hazardous Cargo filter
    if (item.hazardousCargo && !shipment.isHazardous) return false;

    // 8. Perishable Cargo filter
    if (item.perishableCargo && !shipment.isPerishable) return false;

    // 9. Temperature Controlled filter
    if (item.temperatureControlled && !shipment.isTemperatureControlled) return false;

    // 10. Container Required filter
    if (item.containerRequired) {
      const hasContainers = shipment.loadType === "FCL" || shipment.containersCount > 0;
      if (!hasContainers) return false;
    }

    return true;
  });
});

// Dynamic required documents getter
export const getRequiredDocumentsDb = async (shipmentId: string, companyId?: string | null) => {
  const checklist = await getDynamicChecklistForShipment(shipmentId, companyId);
  return checklist.filter(item => !item.isOptional && item.isRequired);
};

// Calculate Compliance Engine metrics
export interface ComplianceMetrics {
  totalCount: number;
  uploadedCount: number;
  missingCount: number;
  requiredRemaining: number;
  completionPercent: number;
  readyForDelivery: boolean;
  readyForCustoms: boolean;
  readyForFinance: boolean;
  readyForClose: boolean;
}

export async function calculateDocumentCompliance(shipmentId: string, companyId?: string | null): Promise<ComplianceMetrics> {
  const [checklist, uploadedDocs] = await Promise.all([
    getDynamicChecklistForShipment(shipmentId, companyId),
    prisma.shipmentdocument.findMany({
      where: {
        shipmentJobId: shipmentId,
        deletedAt: null,
      },
    }),
  ]);

  const totalCount = checklist.length;
  let uploadedCount = 0;
  let missingCount = 0;
  let requiredRemaining = 0;

  // Track state of required documents checklist
  const readyStages = {
    delivery: true,
    customs: true,
    finance: true,
    close: true,
  };

  for (const item of checklist) {
    const matchedDocs = uploadedDocs.filter(
      doc => doc.documentName.toLowerCase() === item.name.toLowerCase()
    );
    const latestDoc = matchedDocs.sort((a, b) => b.version - a.version)[0];
    const isUploaded = latestDoc && latestDoc.status !== "PENDING" && latestDoc.status !== "REJECTED";

    if (isUploaded) {
      uploadedCount++;
    } else {
      missingCount++;
      if (item.isRequired && !item.isOptional) {
        requiredRemaining++;
        
        // Auto validation checkers
        if (item.mandatoryBeforeDeliveryOrder) readyStages.delivery = false;
        if (item.workflowStage === "CUSTOMS_CLEARED" || item.docCategory.toLowerCase() === "customs") {
          readyStages.customs = false;
        }
        if (item.mandatoryBeforeFinanceClose) readyStages.finance = false;
        if (item.mandatoryBeforeJobClose) readyStages.close = false;
      }
    }
  }

  const completionPercent = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 100;

  return {
    totalCount,
    uploadedCount,
    missingCount,
    requiredRemaining,
    completionPercent,
    readyForDelivery: readyStages.delivery,
    readyForCustoms: readyStages.customs,
    readyForFinance: readyStages.finance,
    readyForClose: readyStages.close,
  };
}
