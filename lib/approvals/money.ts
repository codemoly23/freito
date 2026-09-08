import { Prisma } from "@/lib/generated/prisma/client";

export function toBdt(amount: Prisma.Decimal | number | string, exchangeRateToBDT: Prisma.Decimal | number | string) {
  return new Prisma.Decimal(amount).mul(exchangeRateToBDT).toDecimalPlaces(2);
}
