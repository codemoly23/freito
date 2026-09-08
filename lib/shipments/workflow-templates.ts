import type {
  shipmentworkflowstep_serviceScope as ServiceScope,
  shipmentworkflowstep_phase as WorkflowPhase,
  shipmentworkflowstep_visibility as WorkflowVisibility,
} from "@/lib/generated/prisma/client";

export type WorkflowTemplateDefinition = {
  serviceScope: ServiceScope;
  phase: WorkflowPhase;
  stepKey: string;
  title: string;
  sortOrder: number;
  isRequired: boolean;
  defaultVisibility: WorkflowVisibility;
};

const step = (
  serviceScope: ServiceScope,
  phase: WorkflowPhase,
  sortOrder: number,
  stepKey: string,
  title: string,
  visibility: WorkflowVisibility = "INTERNAL_ONLY"
): WorkflowTemplateDefinition => ({
  serviceScope,
  phase,
  stepKey,
  title,
  sortOrder,
  isRequired: true,
  defaultVisibility: visibility,
});

export const defaultWorkflowTemplates: WorkflowTemplateDefinition[] = [
  step("PORT_TO_PORT", "CARRIER", 10, "BOOKING_REQUESTED", "Booking Requested"),
  step("PORT_TO_PORT", "CARRIER", 20, "CARRIER_BOOKING_CONFIRMED", "Carrier Booking Confirmed"),
  step("PORT_TO_PORT", "ORIGIN", 30, "DOCUMENTS_COLLECTED", "Documents Collected"),
  step("PORT_TO_PORT", "ORIGIN", 40, "CARGO_HANDED_TO_CARRIER", "Cargo Handed Over to Carrier"),
  step("PORT_TO_PORT", "CARRIER", 50, "DEPARTED", "Departed"),
  step("PORT_TO_PORT", "DESTINATION", 60, "ARRIVED_DESTINATION_PORT", "Arrived at Destination Port", "CUSTOMER_VISIBLE"),
  step("PORT_TO_PORT", "CLOSURE", 70, "SHIPMENT_CLOSED", "Shipment Closed"),

  step("DOOR_TO_PORT", "ORIGIN", 10, "PICKUP_SCHEDULED", "Pickup Scheduled"),
  step("DOOR_TO_PORT", "ORIGIN", 20, "CARGO_PICKED_UP", "Cargo Picked Up"),
  step("DOOR_TO_PORT", "ORIGIN", 30, "ORIGIN_DOCUMENTS_COLLECTED", "Origin Documents Collected"),
  step("DOOR_TO_PORT", "ORIGIN", 40, "ORIGIN_HANDLING_STARTED", "Export/Origin Handling Started"),
  step("DOOR_TO_PORT", "ORIGIN", 50, "ORIGIN_HANDLING_COMPLETED", "Export/Origin Handling Completed"),
  step("DOOR_TO_PORT", "CARRIER", 60, "CARRIER_BOOKING_CONFIRMED", "Carrier Booking Confirmed"),
  step("DOOR_TO_PORT", "CARRIER", 70, "DEPARTED", "Departed"),
  step("DOOR_TO_PORT", "DESTINATION", 80, "ARRIVED_DESTINATION_PORT", "Arrived at Destination Port", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_PORT", "CLOSURE", 90, "SHIPMENT_CLOSED", "Shipment Closed"),

  step("PORT_TO_DOOR", "CARRIER", 10, "CARRIER_BOOKING_CONFIRMED", "Carrier Booking Confirmed"),
  step("PORT_TO_DOOR", "ORIGIN", 20, "DOCUMENTS_COLLECTED", "Documents Collected"),
  step("PORT_TO_DOOR", "ORIGIN", 30, "CARGO_HANDED_TO_CARRIER", "Cargo Handed Over to Carrier"),
  step("PORT_TO_DOOR", "CARRIER", 40, "DEPARTED", "Departed"),
  step("PORT_TO_DOOR", "DESTINATION", 50, "ARRIVED_DESTINATION_PORT", "Arrived at Destination Port", "CUSTOMER_VISIBLE"),
  step("PORT_TO_DOOR", "DESTINATION", 60, "ARRIVAL_NOTICE_RECEIVED", "Arrival Notice Received"),
  step("PORT_TO_DOOR", "DESTINATION", 70, "DESTINATION_AGENT_ASSIGNED", "Destination Agent Assigned"),
  step("PORT_TO_DOOR", "DESTINATION", 80, "CUSTOMS_CLEARANCE_STARTED", "Customs/C&F Clearance Started", "CUSTOMER_VISIBLE"),
  step("PORT_TO_DOOR", "DESTINATION", 90, "CUSTOMS_CLEARANCE_COMPLETED", "Customs/C&F Clearance Completed", "CUSTOMER_VISIBLE"),
  step("PORT_TO_DOOR", "DESTINATION", 100, "DELIVERY_ORDER_RELEASE", "Release Processing", "CUSTOMER_VISIBLE"),
  step("PORT_TO_DOOR", "DELIVERY", 110, "TRUCK_ASSIGNED", "Delivery Scheduled", "CUSTOMER_VISIBLE"),
  step("PORT_TO_DOOR", "DELIVERY", 120, "OUT_FOR_DELIVERY", "Out for Delivery", "CUSTOMER_VISIBLE"),
  step("PORT_TO_DOOR", "DELIVERY", 130, "DELIVERED_TO_CONSIGNEE", "Delivered", "CUSTOMER_VISIBLE"),
  step("PORT_TO_DOOR", "DELIVERY", 140, "PROOF_OF_DELIVERY_UPLOADED", "POD Available", "CUSTOMER_VISIBLE"),
  step("PORT_TO_DOOR", "CLOSURE", 150, "SHIPMENT_CLOSED", "Shipment Closed"),

  step("DOOR_TO_DOOR", "ORIGIN", 10, "PICKUP_SCHEDULED", "Pickup Scheduled"),
  step("DOOR_TO_DOOR", "ORIGIN", 20, "CARGO_PICKED_UP", "Cargo Picked Up"),
  step("DOOR_TO_DOOR", "ORIGIN", 30, "ORIGIN_DOCUMENTS_COLLECTED", "Origin Documents Collected"),
  step("DOOR_TO_DOOR", "ORIGIN", 40, "ORIGIN_HANDLING_STARTED", "Export/Origin Handling Started"),
  step("DOOR_TO_DOOR", "ORIGIN", 50, "ORIGIN_HANDLING_COMPLETED", "Export/Origin Handling Completed"),
  step("DOOR_TO_DOOR", "CARRIER", 60, "CARRIER_BOOKING_CONFIRMED", "Carrier Booking Confirmed"),
  step("DOOR_TO_DOOR", "CARRIER", 70, "DEPARTED", "Departed"),
  step("DOOR_TO_DOOR", "DESTINATION", 80, "ARRIVED_DESTINATION_PORT", "Arrived at Destination Port", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_DOOR", "DESTINATION", 90, "ARRIVAL_NOTICE_RECEIVED", "Arrival Notice Received"),
  step("DOOR_TO_DOOR", "DESTINATION", 100, "DESTINATION_AGENT_ASSIGNED", "Destination Agent Assigned"),
  step("DOOR_TO_DOOR", "DESTINATION", 110, "CUSTOMS_CLEARANCE_STARTED", "Customs/C&F Clearance Started", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_DOOR", "DESTINATION", 120, "CUSTOMS_CLEARANCE_COMPLETED", "Customs/C&F Clearance Completed", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_DOOR", "DESTINATION", 130, "DELIVERY_ORDER_RELEASE", "Release Processing", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_DOOR", "DELIVERY", 140, "TRUCK_ASSIGNED", "Delivery Scheduled", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_DOOR", "DELIVERY", 150, "OUT_FOR_DELIVERY", "Out for Delivery", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_DOOR", "DELIVERY", 160, "DELIVERED_TO_CONSIGNEE", "Delivered", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_DOOR", "DELIVERY", 170, "PROOF_OF_DELIVERY_UPLOADED", "POD Available", "CUSTOMER_VISIBLE"),
  step("DOOR_TO_DOOR", "CLOSURE", 180, "SHIPMENT_CLOSED", "Shipment Closed"),
];

export const serviceScopeLabels: Record<ServiceScope, string> = {
  PORT_TO_PORT: "Port to Port",
  DOOR_TO_PORT: "Door to Port",
  PORT_TO_DOOR: "Port to Door",
  DOOR_TO_DOOR: "Door to Door",
};

export function scopeUsesPickup(serviceScope: ServiceScope) {
  return serviceScope === "DOOR_TO_PORT" || serviceScope === "DOOR_TO_DOOR";
}

export function scopeUsesDelivery(serviceScope: ServiceScope) {
  return serviceScope === "PORT_TO_DOOR" || serviceScope === "DOOR_TO_DOOR";
}
