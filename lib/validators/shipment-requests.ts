import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional();

const optionalDate = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() ? value : null),
    z.coerce.date().nullable(),
  )
  .optional();

const optionalNumber = z
  .string()
  .trim()
  .transform((value) => (value.length ? Number(value) : null))
  .pipe(z.number().nonnegative("Value cannot be negative.").nullable())
  .optional();

const optionalInt = z
  .string()
  .trim()
  .transform((value) => (value.length ? Number(value) : null))
  .pipe(z.number().int("Enter a whole number.").nonnegative().nullable())
  .optional();

export const shipmentRequestSchema = z
  .object({
    shipmentType: z.enum(["IMPORT", "EXPORT"]),
    transportMode: z.enum(["SEA", "AIR", "LAND"]),
    serviceScope: z.enum([
      "PORT_TO_PORT",
      "DOOR_TO_PORT",
      "PORT_TO_DOOR",
      "DOOR_TO_DOOR",
    ]),
    loadType: z.enum(["FCL", "LCL", "AIR_CARGO", "TRUCK"]).nullable().optional(),
    incoterm: z
      .enum(["FOB", "CIF", "CNF", "EXW", "DDP", "DAP", "FCA", "OTHER"])
      .nullable()
      .optional(),
    originCountry: z.string().trim().min(1, "Origin country is required."),
    originPort: optionalText,
    originAddress: optionalText,
    destinationCountry: z
      .string()
      .trim()
      .min(1, "Destination country is required."),
    destinationPort: optionalText,
    destinationAddress: optionalText,
    pickupAddress: optionalText,
    deliveryAddress: optionalText,
    cargoDescription: z.string().trim().min(1, "Cargo description is required."),
    commodity: optionalText,
    hsCode: optionalText,
    packageType: optionalText,
    shipperName: optionalText,
    shipperAddress: optionalText,
    consigneeName: optionalText,
    consigneeAddress: optionalText,
    consigneeBin: optionalText,
    notifyPartyName: optionalText,
    notifyPartyAddress: optionalText,
    notifyPartyBin: optionalText,
    packageCount: optionalInt,
    grossWeight: optionalNumber,
    netWeight: optionalNumber,
    chargeableWeight: optionalNumber,
    cbm: optionalNumber,
    readyDate: optionalDate,
    expectedShipmentDate: optionalDate,
    expectedDeliveryDate: optionalDate,
    customerReference: optionalText,
    customerNotes: optionalText,
    containerRequirement: optionalText,
    specialHandlingNote: optionalText,
    isDangerousGoods: z.boolean().optional().default(false),
    isReefer: z.boolean().optional().default(false),
    isFragile: z.boolean().optional().default(false),
    requestedEtd: optionalDate,
    requestedEta: optionalDate,
    internalNotes: optionalText,
  })
  .superRefine((data, ctx) => {
    if (
      ["DOOR_TO_PORT", "DOOR_TO_DOOR"].includes(data.serviceScope) &&
      !data.pickupAddress
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["pickupAddress"],
        message: "Pickup address is required for door-origin service.",
      });
    }
    if (
      ["PORT_TO_DOOR", "DOOR_TO_DOOR"].includes(data.serviceScope) &&
      !data.deliveryAddress
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Delivery address is required for door-destination service.",
      });
    }
  });

export const shipmentRequestStatusSchema = z.object({
  shipmentRequestId: z.string().min(1),
  status: z.enum([
    "UNDER_REVIEW",
    "QUOTED",
    "CANCELLED",
  ]),
  internalNotes: optionalText,
});

export const portalQuotationResponseSchema = z.object({
  shipmentRequestId: z.string().min(1),
  quotationId: z.string().min(1),
  action: z.enum(["ACCEPT", "REJECT", "REVISION"]),
  message: optionalText,
});

export const dashboardShipmentRequestSchema = shipmentRequestSchema.extend({
  customerId: z.string().trim().min(1, "Customer is required."),
});

export type ShipmentRequestInput = z.infer<typeof shipmentRequestSchema>;
export type DashboardShipmentRequestInput = z.infer<typeof dashboardShipmentRequestSchema>;
