import { z } from "zod";
import { chargeTypes, currencies } from "@/lib/validators/finance";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().optional(),
);
const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.coerce.date().optional(),
);
const nonnegative = z.coerce.number().nonnegative("Must be zero or more.");

export const invoiceHeaderSchema = z.object({
  id: optionalString,
  customerId: z.string().min(1, "Customer is required."),
  shipmentJobId: optionalString,
  quotationId: optionalString,
  invoiceDate: z.coerce.date(),
  dueDate: optionalDate,
  currency: z.enum(currencies),
  exchangeRateToBDT: z.coerce.number().positive("Exchange rate must be greater than zero."),
  discountAmount: nonnegative,
  taxAmount: nonnegative,
  remarks: optionalString,
});

export const vendorBillHeaderSchema = z.object({
  id: optionalString,
  vendorId: z.string().min(1, "Vendor is required."),
  shipmentJobId: optionalString,
  billDate: z.coerce.date(),
  dueDate: optionalDate,
  currency: z.enum(currencies),
  exchangeRateToBDT: z.coerce.number().positive("Exchange rate must be greater than zero."),
  discountAmount: nonnegative,
  taxAmount: nonnegative,
  remarks: optionalString,
});

export const billingLineSchema = z.object({
  description: z.string().trim().min(1, "Line description is required."),
  chargeType: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(chargeTypes).optional(),
  ),
  quantity: z.coerce.number().positive("Quantity must be greater than zero."),
  unitPrice: nonnegative,
  remarks: optionalString,
});

export const paymentSchema = z.object({
  direction: z.enum(["RECEIVED", "PAID"]),
  customerId: optionalString,
  vendorId: optionalString,
  invoiceId: optionalString,
  vendorBillId: optionalString,
  shipmentJobId: optionalString,
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum([
    "CASH",
    "BANK_TRANSFER",
    "CHEQUE",
    "MOBILE_BANKING",
    "CARD",
    "OTHER",
  ]),
  referenceNo: optionalString,
  currency: z.enum(currencies),
  exchangeRateToBDT: z.coerce.number().positive("Exchange rate must be greater than zero."),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  remarks: optionalString,
});

export const paymentUpdateSchema = z.object({
  id: z.string().min(1),
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum([
    "CASH",
    "BANK_TRANSFER",
    "CHEQUE",
    "MOBILE_BANKING",
    "CARD",
    "OTHER",
  ]),
  referenceNo: optionalString,
  remarks: optionalString,
});
