import { z } from "zod";

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), z.enum(values).optional());

const requiredEnum = <T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.preprocess((value) => (value === "" ? undefined : value), z.enum(values, { error: message }));

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().optional(),
);

const requiredString = (message: string) => z.string().trim().min(1, message);

const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.date().optional(),
);

const optionalInt = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().int().nonnegative("Must be zero or more.").optional(),
);

const optionalDecimal = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.number().nonnegative("Must be zero or more.").optional(),
);

const requiredDecimal = z.coerce.number().nonnegative("Must be zero or more.");
const exchangeRate = z.coerce.number().positive("Exchange rate must be greater than zero.");

export const shipmentTypes = ["IMPORT", "EXPORT"] as const;
export const transportModes = ["SEA", "AIR", "LAND"] as const;
export const loadTypes = ["FCL", "LCL", "AIR_CARGO", "TRUCK"] as const;
export const tradeTerms = ["FOB", "CIF", "CNF", "EXW", "DDP", "DAP", "FCA", "OTHER"] as const;
export const chargeTypes = [
  "FREIGHT",
  "ORIGIN",
  "DESTINATION",
  "CUSTOMS",
  "TRANSPORT",
  "DOCUMENTATION",
  "PORT",
  "WAREHOUSE",
  "INSURANCE",
  "OTHER",
] as const;
export const chargeBasisValues = [
  "PER_SHIPMENT",
  "PER_CONTAINER",
  "PER_CBM",
  "PER_KG",
  "PER_TON",
  "PER_PACKAGE",
  "PER_DOCUMENT",
  "OTHER",
] as const;
export const currencies = ["BDT", "USD", "EUR", "GBP", "CNY", "INR", "AED", "RUB", "OTHER"] as const;
export const quotationStatuses = [
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const;

export const quotationSchema = z.object({
  id: optionalString,
  customerId: z.string().min(1, "Customer is required."),
  shipmentJobId: optionalString,
  shipmentType: requiredEnum(shipmentTypes, "Shipment type is required."),
  transportMode: requiredEnum(transportModes, "Transport mode is required."),
  loadType: optionalEnum(loadTypes),
  tradeTerm: optionalEnum(tradeTerms),
  originCountry: requiredString("Origin country is required."),
  originPort: optionalString,
  destinationCountry: requiredString("Destination country is required."),
  destinationPort: optionalString,
  cargoDescription: optionalString,
  packageCount: optionalInt,
  grossWeight: optionalDecimal,
  chargeableWeight: optionalDecimal,
  cbm: optionalDecimal,
  validUntil: optionalDate,
  remarks: optionalString,
});

export const quotationChargeSchema = z.object({
  id: optionalString,
  quotationId: z.string().min(1, "Quotation is required."),
  chargeName: z.string().trim().min(1, "Charge name is required."),
  chargeType: z.enum(chargeTypes),
  chargeBasis: z.enum(chargeBasisValues),
  currency: z.enum(currencies),
  quantity: requiredDecimal,
  buyRate: requiredDecimal,
  sellRate: requiredDecimal,
  exchangeRateToBDT: exchangeRate,
  vendorId: optionalString,
  remarks: optionalString,
});

export const quotationChargeRowSchema = quotationChargeSchema.omit({ quotationId: true });

export type QuotationChargeRowInput = z.infer<typeof quotationChargeRowSchema>;

export const quotationStatusSchema = z.object({
  quotationId: z.string().min(1, "Quotation is required."),
  status: z.enum(quotationStatuses),
});

export const shipmentCostSchema = z.object({
  id: optionalString,
  shipmentJobId: z.string().min(1, "Shipment is required."),
  chargeName: z.string().trim().min(1, "Charge name is required."),
  chargeType: z.enum(chargeTypes),
  chargeBasis: z.enum(chargeBasisValues),
  currency: z.enum(currencies),
  quantity: requiredDecimal,
  buyRate: requiredDecimal,
  sellRate: requiredDecimal,
  exchangeRateToBDT: exchangeRate,
  vendorId: optionalString,
  customerId: optionalString,
  sourceQuotationId: optionalString,
  remarks: optionalString,
});
