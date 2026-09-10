import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = Prisma.TransactionClient | typeof prisma | PrismaClient;

/**
 * "1 unit of `currency` = rateToUSD USD" — same multiply-to-convert
 * direction as the existing `exchangeRateToBDT` convention used on
 * invoice/vendorbill/payment. USD itself is always exactly 1 and never
 * looked up. Uses the latest rate with effectiveDate <= asOfDate; if none
 * exists yet (rates haven't been entered), falls back to the latest rate
 * on file for that currency regardless of date, and finally to a inert
 * placeholder of 1 — this must never throw, since a missing exchange rate
 * is a data-entry gap, not a reason to block a business transaction.
 */
export async function getRateToUSD(currency: string, asOfDate: Date, db: Db = prisma): Promise<Prisma.Decimal> {
  if (currency === "USD") return new Prisma.Decimal(1);

  const nearestPast = await db.exchangerate.findFirst({
    where: { currency: currency as never, effectiveDate: { lte: asOfDate } },
    orderBy: { effectiveDate: "desc" },
    select: { rateToUSD: true },
  });
  if (nearestPast) return nearestPast.rateToUSD;

  const latestAny = await db.exchangerate.findFirst({
    where: { currency: currency as never },
    orderBy: { effectiveDate: "desc" },
    select: { rateToUSD: true },
  });
  if (latestAny) return latestAny.rateToUSD;

  return new Prisma.Decimal(1);
}

export async function upsertExchangeRate(input: { currency: string; rateToUSD: Prisma.Decimal | number | string; effectiveDate: Date }) {
  return prisma.exchangerate.upsert({
    where: { currency_effectiveDate: { currency: input.currency as never, effectiveDate: input.effectiveDate } },
    update: { rateToUSD: input.rateToUSD },
    create: {
      id: randomUUID(),
      currency: input.currency as never,
      rateToUSD: input.rateToUSD,
      effectiveDate: input.effectiveDate,
    },
  });
}

export async function listLatestExchangeRates() {
  const rates = await prisma.exchangerate.findMany({ orderBy: { effectiveDate: "desc" } });
  const latestByCurrency = new Map<string, (typeof rates)[number]>();
  for (const rate of rates) {
    if (!latestByCurrency.has(rate.currency)) latestByCurrency.set(rate.currency, rate);
  }
  return [...latestByCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
