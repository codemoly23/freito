export const exportStatusFlow = [
  "Booking Requested",
  "Booking Confirmed",
  "Cargo Picked Up",
  "Port Gate In",
  "Customs Processing",
  "Customs Cleared",
  "Loaded on Vessel",
  "Sailed",
  "BL Issued",
  "Documents Sent",
  "Arrived at Destination",
  "Delivered",
  "Closed",
] as const;

export const importStatusFlow = [
  "Pre-alert Received",
  "IGM Submitted",
  "Vessel Arrived",
  "Bill of Entry Submitted",
  "Assessment Done",
  "Duty Paid",
  "DO Collected",
  "Port Release",
  "Truck Out",
  "Delivered to Customer",
  "Closed",
] as const;

export function getShipmentStatusFlow(shipmentType: string) {
  return shipmentType === "IMPORT" ? importStatusFlow : exportStatusFlow;
}

export function defaultShipmentStatus(shipmentType: string) {
  return shipmentType === "IMPORT" ? importStatusFlow[0] : exportStatusFlow[0];
}

export const shipmentTypeLabels = {
  IMPORT: "Import",
  EXPORT: "Export",
} as const;

export const transportModeLabels = {
  SEA: "Sea",
  AIR: "Air",
  LAND: "Land",
} as const;
