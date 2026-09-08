import { z } from "zod";
import { getShipmentStatusFlow } from "@/lib/shipments/constants";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional();

const optionalDate = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim().length ? value : null),
    z.coerce.date().nullable(),
  )
  .optional();

const optionalNonNegativeNumber = z
  .string()
  .trim()
  .transform((value) => (value.length ? Number(value) : null))
  .pipe(z.number().nonnegative("Value cannot be negative.").nullable())
  .optional();

const optionalNonNegativeInt = z
  .string()
  .trim()
  .transform((value) => (value.length ? Number(value) : null))
  .pipe(z.number().int("Enter a whole number.").nonnegative("Value cannot be negative.").nullable())
  .optional();

export const shipmentJobSchema = z
  .object({
    id: z.string().optional(),
    customerId: z.string().min(1, "Customer is required."),
    shipmentType: z.enum(["IMPORT", "EXPORT"]),
    transportMode: z.enum(["SEA", "AIR", "LAND"]),
    loadType: z.enum(["FCL", "LCL", "AIR_CARGO", "TRUCK"]),
    serviceScope: z.enum(["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"]),
    tradeTerm: z.enum(["FOB", "CIF", "CNF", "EXW", "DDP", "DAP", "FCA", "OTHER"]).nullable().optional(),
    originCountry: z.string().trim().min(1, "Origin country is required."),
    originPort: optionalText,
    destinationCountry: z.string().trim().min(1, "Destination country is required."),
    destinationPort: optionalText,
    placeOfReceipt: optionalText,
    placeOfDelivery: optionalText,
    pickupAddress: optionalText,
    deliveryAddress: optionalText,
    shipperName: optionalText,
    consigneeName: optionalText,
    notifyParty: optionalText,
    carrierName: optionalText,
    shippingLineOrAirline: optionalText,
    vesselName: optionalText,
    voyageNo: optionalText,
    flightNo: optionalText,
    mblNo: optionalText,
    hblNo: optionalText,
    mawbNo: optionalText,
    hawbNo: optionalText,
    bookingNo: optionalText,
    blOrAwbDate: optionalDate,
    etd: optionalDate,
    eta: optionalDate,
    actualDeparture: optionalDate,
    actualArrival: optionalDate,
    currentStatus: optionalText,
    cargoDescription: z.string().trim().min(1, "Cargo description is required."),
    hsCode: optionalText,
    packageCount: optionalNonNegativeInt,
    packageType: optionalText,
    grossWeight: optionalNonNegativeNumber,
    netWeight: optionalNonNegativeNumber,
    chargeableWeight: optionalNonNegativeNumber,
    cbm: optionalNonNegativeNumber,
    assignedToId: z.string().min(1, "Assigned employee is required."),
  })
  .superRefine((data, ctx) => {
    if (data.etd && data.eta && data.eta < data.etd) {
      ctx.addIssue({
        code: "custom",
        path: ["eta"],
        message: "ETA cannot be before ETD.",
      });
    }
    if (
      (data.serviceScope === "DOOR_TO_PORT" || data.serviceScope === "DOOR_TO_DOOR") &&
      !data.pickupAddress
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["pickupAddress"],
        message: "Pickup address is required for door-origin service.",
      });
    }
    if (
      (data.serviceScope === "PORT_TO_DOOR" || data.serviceScope === "DOOR_TO_DOOR") &&
      !data.deliveryAddress
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Delivery address is required for door-destination service.",
      });
    }
  });

export const shipmentWorkflowStepUpdateSchema = z.object({
  shipmentJobId: z.string().min(1),
  workflowStepId: z.string().min(1),
  status: z.enum([
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING",
    "COMPLETED",
    "BLOCKED",
    "CANCELLED",
  ]),
  dueDate: optionalDate,
  notes: optionalText,
});

export const shipmentWorkflowAssignmentSchema = z
  .object({
    shipmentJobId: z.string().min(1),
    workflowStepId: z.string().min(1),
    handlerType: z
      .enum([
        "INTERNAL_EMPLOYEE",
        "EXTERNAL_AGENT",
        "VENDOR",
        "CF_AGENT",
        "TRUCK_PROVIDER",
        "DESTINATION_AGENT",
      ])
      .nullable()
      .optional(),
    assignedUserId: optionalText,
    vendorId: optionalText,
  })
  .superRefine((data, ctx) => {
    if (data.handlerType === "INTERNAL_EMPLOYEE" && !data.assignedUserId) {
      ctx.addIssue({
        code: "custom",
        path: ["assignedUserId"],
        message: "Select an internal employee.",
      });
    }
    if (
      data.handlerType &&
      data.handlerType !== "INTERNAL_EMPLOYEE" &&
      !data.vendorId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["vendorId"],
        message: "Select a vendor or agent.",
      });
    }
  });

export const containerSchema = z.object({
  id: z.string().optional(),
  shipmentJobId: z.string().min(1),
  containerNo: z.string().trim().min(1, "Container number is required."),
  sealNo: optionalText,
  containerType: optionalText,
  packageCount: optionalNonNegativeInt,
  grossWeight: optionalNonNegativeNumber,
  cbm: optionalNonNegativeNumber,
  gateInDate: optionalDate,
  gateOutDate: optionalDate,
  freeTimeLastDate: optionalDate,
  demurrageRiskStatus: z.enum(["SAFE", "WARNING", "CRITICAL", "NOT_APPLICABLE"]),
});

export const shipmentStatusSchema = z
  .object({
    shipmentJobId: z.string().min(1),
    shipmentType: z.enum(["IMPORT", "EXPORT"]),
    status: z.string().trim().min(1, "Status is required."),
    remarks: optionalText,
  })
  .superRefine((data, ctx) => {
    if (!getShipmentStatusFlow(data.shipmentType).includes(data.status as never)) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Select a valid status for this shipment type.",
      });
    }
  });

export type ShipmentJobInput = z.infer<typeof shipmentJobSchema>;
export type ContainerInput = z.infer<typeof containerSchema>;
export type ShipmentStatusInput = z.infer<typeof shipmentStatusSchema>;
export type ShipmentWorkflowStepInput = z.infer<typeof shipmentWorkflowStepUpdateSchema>;
