import { Prisma } from "@/lib/generated/prisma/client";

type DecimalValue = number | string | Prisma.Decimal;

export function calculateLineAmount(quantity: DecimalValue, unitPrice: DecimalValue) {
  return new Prisma.Decimal(quantity).mul(unitPrice).toDecimalPlaces(2);
}

export function calculateDocumentTotals(
  amounts: Prisma.Decimal[],
  discountAmount: DecimalValue,
  taxAmount: DecimalValue,
) {
  const subtotal = amounts.reduce(
    (total, amount) => total.add(amount),
    new Prisma.Decimal(0),
  );
  const discount = new Prisma.Decimal(discountAmount);
  const tax = new Prisma.Decimal(taxAmount);
  const totalAmount = subtotal.sub(discount).add(tax).toDecimalPlaces(2);
  return { subtotal: subtotal.toDecimalPlaces(2), totalAmount };
}

export function invoicePaymentStatus(
  paid: Prisma.Decimal,
  total: Prisma.Decimal,
  previous: string,
  dueDate?: Date | null,
) {
  if (previous === "CANCELLED") return "CANCELLED" as const;
  if (paid.greaterThanOrEqualTo(total)) return "PAID" as const;
  if (paid.greaterThan(0)) return "PARTIALLY_PAID" as const;
  if (dueDate && dueDate < new Date()) return "OVERDUE" as const;
  return previous === "SENT" ? "SENT" as const : "DRAFT" as const;
}

export function vendorBillPaymentStatus(
  paid: Prisma.Decimal,
  total: Prisma.Decimal,
  previous: string,
  dueDate?: Date | null,
) {
  if (previous === "CANCELLED") return "CANCELLED" as const;
  if (paid.greaterThanOrEqualTo(total)) return "PAID" as const;
  if (paid.greaterThan(0)) return "PARTIALLY_PAID" as const;
  if (dueDate && dueDate < new Date()) return "OVERDUE" as const;
  return previous === "RECEIVED" ? "RECEIVED" as const : "DRAFT" as const;
}
