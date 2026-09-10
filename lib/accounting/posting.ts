import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { getRateToUSD } from "@/lib/accounting/exchange-rates";

export class JournalPostingError extends Error {}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type JournalVoucherType = "SALES" | "PURCHASE" | "RECEIPT" | "PAYMENT" | "CONTRA" | "JOURNAL";
export type JournalSide = "DEBIT" | "CREDIT";

export type JournalLineInput = {
  ledgerAccountId: string;
  side: JournalSide;
  amount: Prisma.Decimal | number | string;
  lineNarration?: string | null;
};

export type JournalEntrySourceInput = {
  companyId: string;
  entryDate: Date;
  voucherType: JournalVoucherType;
  narration?: string | null;
  sourceType: string;
  sourceId: string;
  createdById: string;
  currency: string;
  exchangeRateToBDT: Prisma.Decimal | number | string;
  lines: JournalLineInput[];
};

function assertBalanced(lines: JournalLineInput[]) {
  const debit = lines
    .filter((line) => line.side === "DEBIT")
    .reduce((sum, line) => sum.add(new Prisma.Decimal(line.amount)), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
  const credit = lines
    .filter((line) => line.side === "CREDIT")
    .reduce((sum, line) => sum.add(new Prisma.Decimal(line.amount)), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
  if (!debit.equals(credit)) {
    throw new JournalPostingError(`Journal entry does not balance: debit ${debit.toFixed(2)} vs credit ${credit.toFixed(2)}.`);
  }
}

function buildLineRows(
  lines: JournalLineInput[],
  currency: string,
  exchangeRateToBDT: Prisma.Decimal | number | string,
  rateToUSD: Prisma.Decimal,
) {
  const rateToBDT = new Prisma.Decimal(exchangeRateToBDT);
  return lines.map((line) => {
    const nativeAmount = new Prisma.Decimal(line.amount).toDecimalPlaces(2);
    return {
      id: randomUUID(),
      ledgerAccountId: line.ledgerAccountId,
      side: line.side,
      nativeAmount,
      nativeCurrency: currency as never,
      rateToBDT,
      amountBDT: nativeAmount.mul(rateToBDT).toDecimalPlaces(2),
      rateToUSD,
      amountUSD: nativeAmount.mul(rateToUSD).toDecimalPlaces(2),
      lineNarration: line.lineNarration ?? null,
    };
  });
}

/**
 * Creates or updates the single journal entry identified by
 * (companyId, sourceType, sourceId, voucherType). If no entry exists yet for
 * that source, one is posted. If it already exists (and hasn't been
 * reversed or locked), its lines are replaced with the freshly computed
 * ones — this is what keeps the ledger in sync when a SENT invoice / a
 * RECEIVED vendor bill is edited afterwards, without needing a separate
 * reverse-then-repost dance that would collide with the uniqueness
 * constraint on (companyId, sourceType, sourceId, voucherType).
 *
 * Never throws for "the books are locked" or "nothing to post" — returns
 * null instead, since a ledger-side inconsistency must never block the
 * caller's own business transaction (invoice send, payment, etc.).
 */
export async function syncJournalEntry(tx: Prisma.TransactionClient, input: JournalEntrySourceInput): Promise<string | null> {
  if (!input.lines.length) return null;
  assertBalanced(input.lines);

  const company = await tx.company.findUnique({ where: { id: input.companyId }, select: { booksLockedThrough: true } });
  if (company?.booksLockedThrough && input.entryDate <= company.booksLockedThrough) {
    return null;
  }

  const existing = await tx.journalentry.findFirst({
    where: {
      companyId: input.companyId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      voucherType: input.voucherType,
    },
    select: { id: true, reversedByEntryId: true, locked: true },
  });

  const rateToUSD = await getRateToUSD(input.currency, input.entryDate, tx);

  if (existing) {
    if (existing.reversedByEntryId || existing.locked) return existing.id;
    await tx.journalentryline.deleteMany({ where: { journalEntryId: existing.id } });
    await tx.journalentryline.createMany({
      data: buildLineRows(input.lines, input.currency, input.exchangeRateToBDT, rateToUSD).map((line) => ({
        ...line,
        journalEntryId: existing.id,
      })),
    });
    await tx.journalentry.update({
      where: { id: existing.id },
      data: { entryDate: input.entryDate, narration: input.narration ?? null, updatedAt: new Date() },
    });
    return existing.id;
  }

  const entryId = randomUUID();
  try {
    await tx.journalentry.create({
      data: {
        id: entryId,
        companyId: input.companyId,
        entryDate: input.entryDate,
        voucherType: input.voucherType,
        narration: input.narration ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        createdById: input.createdById,
        updatedAt: new Date(),
        journalentryline: { create: buildLineRows(input.lines, input.currency, input.exchangeRateToBDT, rateToUSD) },
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const raced = await tx.journalentry.findFirst({
        where: {
          companyId: input.companyId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          voucherType: input.voucherType,
        },
        select: { id: true },
      });
      return raced?.id ?? null;
    }
    throw error;
  }
  return entryId;
}

/**
 * Reverses the journal entry identified by (companyId, sourceType, sourceId,
 * voucherType) by posting a mirrored entry with every line's side flipped —
 * a proper audit-trail reversal (both the original and the reversal remain
 * visible in the ledger), used for cancellation/deletion of an already-
 * posted document. No-op if nothing was posted for that source, or if it
 * was already reversed.
 */
export async function reverseJournalEntry(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    sourceType: string;
    sourceId: string;
    voucherType: JournalVoucherType;
    createdById: string;
    entryDate?: Date;
    narration?: string;
  },
): Promise<string | null> {
  const original = await tx.journalentry.findFirst({
    where: {
      companyId: input.companyId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      voucherType: input.voucherType,
    },
    include: { journalentryline: true },
  });
  if (!original || original.reversedByEntryId) return null;

  const reversalId = randomUUID();
  await tx.journalentry.create({
    data: {
      id: reversalId,
      companyId: original.companyId,
      entryDate: input.entryDate ?? new Date(),
      voucherType: original.voucherType,
      narration: input.narration ?? `Reversal of ${input.sourceType}:${input.sourceId}`,
      sourceType: "REVERSAL",
      sourceId: original.id,
      createdById: input.createdById,
      updatedAt: new Date(),
      journalentryline: {
        create: original.journalentryline.map((line) => ({
          id: randomUUID(),
          ledgerAccountId: line.ledgerAccountId,
          side: line.side === "DEBIT" ? "CREDIT" : "DEBIT",
          nativeAmount: line.nativeAmount,
          nativeCurrency: line.nativeCurrency,
          rateToUSD: line.rateToUSD,
          rateToBDT: line.rateToBDT,
          amountUSD: line.amountUSD,
          amountBDT: line.amountBDT,
          lineNarration: line.lineNarration,
        })),
      },
    },
  });
  await tx.journalentry.update({ where: { id: original.id }, data: { reversedByEntryId: reversalId } });
  return reversalId;
}
