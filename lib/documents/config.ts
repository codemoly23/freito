export type DocumentOwner = 'CLIENT' | 'FREIGHT_FORWARDER' | 'CARRIER' | 'CUSTOMS' | 'BANK' | 'OTHER';
export type DocumentScope = 'COMMON' | 'IMPORT_ONLY' | 'EXPORT_ONLY';
export type DocumentRequirement = 'MANDATORY' | 'OPTIONAL';
export type DocumentTransportMode = 'ALL' | 'SEA' | 'AIR' | 'ROAD' | 'MULTIMODAL';

export interface DocumentMasterItem {
  code: string;
  name: string;
  owner: DocumentOwner;
  scope: DocumentScope;
  requirement: DocumentRequirement;
  transportMode: DocumentTransportMode;
  portalVisible: boolean;
}

export const DOCUMENT_MASTER: DocumentMasterItem[] = [
  // --- CLIENT DOCUMENTS ---
  // COMMON REQUIRED
  { code: 'commercial_invoice', name: 'Commercial Invoice', owner: 'CLIENT', scope: 'COMMON', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  { code: 'packing_list', name: 'Packing List', owner: 'CLIENT', scope: 'COMMON', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  
  // COMMON OPTIONAL
  { code: 'certificate_of_origin', name: 'Certificate of Origin', owner: 'CLIENT', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'insurance_certificate', name: 'Insurance Certificate', owner: 'CLIENT', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'lc_copy', name: 'LC Copy', owner: 'CLIENT', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'tt_copy', name: 'TT Copy', owner: 'CLIENT', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'authorization_letter', name: 'Authorization Letter', owner: 'CLIENT', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'correspondence', name: 'Correspondence', owner: 'CLIENT', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'other_supporting_docs', name: 'Other Supporting Documents', owner: 'CLIENT', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  
  // IMPORT REQUIRED
  { code: 'bin_certificate', name: 'BIN Certificate', owner: 'CLIENT', scope: 'IMPORT_ONLY', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  { code: 'irc', name: 'IRC', owner: 'CLIENT', scope: 'IMPORT_ONLY', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  
  // IMPORT OPTIONAL
  { code: 'import_permit', name: 'Import Permit', owner: 'CLIENT', scope: 'IMPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'bsti_approval', name: 'BSTI Approval', owner: 'CLIENT', scope: 'IMPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'drug_license', name: 'Drug License', owner: 'CLIENT', scope: 'IMPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'noc', name: 'NOC', owner: 'CLIENT', scope: 'IMPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'radioactivity_certificate', name: 'Radioactivity Certificate', owner: 'CLIENT', scope: 'IMPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'other_government_approval', name: 'Other Government Approval', owner: 'CLIENT', scope: 'IMPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  
  // EXPORT REQUIRED
  { code: 'erc', name: 'ERC', owner: 'CLIENT', scope: 'EXPORT_ONLY', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  
  // EXPORT OPTIONAL
  { code: 'export_permit', name: 'Export Permit', owner: 'CLIENT', scope: 'EXPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'phytosanitary_certificate', name: 'Phytosanitary Certificate', owner: 'CLIENT', scope: 'EXPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'fumigation_certificate', name: 'Fumigation Certificate', owner: 'CLIENT', scope: 'EXPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'health_certificate', name: 'Health Certificate', owner: 'CLIENT', scope: 'EXPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'inspection_certificate', name: 'Inspection Certificate', owner: 'CLIENT', scope: 'EXPORT_ONLY', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },

  // --- FREIGHT FORWARDER DOCUMENTS ---
  // COMMON REQUIRED
  { code: 'hbl', name: 'House Bill of Lading (HBL)', owner: 'FREIGHT_FORWARDER', scope: 'COMMON', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  { code: 'booking_confirmation', name: 'Booking Confirmation', owner: 'FREIGHT_FORWARDER', scope: 'COMMON', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  { code: 'shipping_instruction', name: 'Shipping Instruction', owner: 'FREIGHT_FORWARDER', scope: 'COMMON', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  { code: 'freight_invoice', name: 'Freight Invoice', owner: 'FREIGHT_FORWARDER', scope: 'COMMON', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  
  // COMMON OPTIONAL
  { code: 'arrival_notice', name: 'Arrival Notice', owner: 'FREIGHT_FORWARDER', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },
  { code: 'debit_note', name: 'Debit Note', owner: 'FREIGHT_FORWARDER', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: false },
  { code: 'credit_note', name: 'Credit Note', owner: 'FREIGHT_FORWARDER', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: false },
  { code: 'cargo_receipt', name: 'Cargo Receipt', owner: 'FREIGHT_FORWARDER', scope: 'COMMON', requirement: 'OPTIONAL', transportMode: 'ALL', portalVisible: true },

  // --- CARRIER DOCUMENTS ---
  // COMMON REQUIRED
  { code: 'master_bl', name: 'Master BL', owner: 'CARRIER', scope: 'COMMON', requirement: 'MANDATORY', transportMode: 'SEA', portalVisible: true },
  { code: 'master_awb', name: 'Master AWB', owner: 'CARRIER', scope: 'COMMON', requirement: 'MANDATORY', transportMode: 'AIR', portalVisible: true },
  
  // IMPORT REQUIRED
  { code: 'delivery_order', name: 'Delivery Order', owner: 'CARRIER', scope: 'IMPORT_ONLY', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },

  // --- CUSTOMS DOCUMENTS ---
  // IMPORT REQUIRED
  { code: 'bill_of_entry', name: 'Bill of Entry', owner: 'CUSTOMS', scope: 'IMPORT_ONLY', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  { code: 'duty_payment_doc', name: 'Duty Payment Document', owner: 'CUSTOMS', scope: 'IMPORT_ONLY', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true },
  { code: 'customs_release', name: 'Customs Release', owner: 'CUSTOMS', scope: 'IMPORT_ONLY', requirement: 'MANDATORY', transportMode: 'ALL', portalVisible: true }
];

export function getChecklistForShipment(
  shipmentType: 'IMPORT' | 'EXPORT',
  transportMode: 'SEA' | 'AIR' | 'LAND'
): DocumentMasterItem[] {
  // Map transport mode to config format
  const modeMap: Record<string, string> = {
    LAND: 'ROAD',
    SEA: 'SEA',
    AIR: 'AIR'
  };
  const currentMode = modeMap[transportMode] || transportMode;

  return DOCUMENT_MASTER.filter(item => {
    // Check scope/shipmentType
    if (item.scope === 'IMPORT_ONLY' && shipmentType !== 'IMPORT') return false;
    if (item.scope === 'EXPORT_ONLY' && shipmentType !== 'EXPORT') return false;
    
    // Check transportMode
    if (item.transportMode !== 'ALL' && item.transportMode !== currentMode) {
      if (item.transportMode === 'MULTIMODAL') {
        return true;
      }
      return false;
    }
    return true;
  });
}

export function getRequiredDocuments(
  shipmentType: 'IMPORT' | 'EXPORT',
  transportMode: 'SEA' | 'AIR' | 'LAND'
): DocumentMasterItem[] {
  return getChecklistForShipment(shipmentType, transportMode).filter(
    item => item.requirement === 'MANDATORY'
  );
}
