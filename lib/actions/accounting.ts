"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ledgerAccountSchema, journalVoucherLineSchema } from "@/lib/validators/accounting";
import { syncJournalEntry, JournalPostingError } from "@/lib/accounting/posting";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

function revalidateAccountingPaths() {
  revalidatePath("/dashboard/accounting/ledgers");
  revalidatePath("/dashboard/accounting/journal-vouchers");
  revalidatePath("/dashboard/accounting/opening-balances");
}

/**
 * Bulk opening-balance entry (Phase 6). Unlike `saveLedgerAccount`, this
 * deliberately CAN set the balance on system-managed ledgers (customer,
 * vendor, bank/cash, job-category accounts) — that's exactly where most
 * real opening balances land — while still never touching their name or
 * group. `booksOpeningDate` records the single "as of" date all of these
 * balances apply to, so the accounting reports can default their date
 * filter to it instead of "last 30 days".
 */
export async function saveOpeningBalances(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("accounts:manage");

  const booksOpeningDateStr = getString(formData, "booksOpeningDate");
  const ledgerAccountIds = formData.getAll("openingLedgerAccountId").map(String);
  const amounts = formData.getAll("openingAmount").map(String);
  const sides = formData.getAll("openingSide").map(String);

  const rows = ledgerAccountIds
    .map((ledgerAccountId, index) => ({
      ledgerAccountId,
      amount: new Prisma.Decimal(amounts[index] || "0"),
      side: (sides[index] === "CREDIT" ? "CREDIT" : "DEBIT") as "DEBIT" | "CREDIT",
    }))
    .filter((row) => row.ledgerAccountId && row.amount.greaterThan(0));

  if (rows.length) {
    const ledgers = await prisma.ledgeraccount.findMany({
      where: { id: { in: rows.map((row) => row.ledgerAccountId) }, companyId, deletedAt: null },
      select: { id: true },
    });
    const validIds = new Set(ledgers.map((ledger) => ledger.id));
    const invalidRow = rows.find((row) => !validIds.has(row.ledgerAccountId));
    if (invalidRow) return validationError("One or more ledger accounts are invalid.");

    await prisma.$transaction(
      rows.map((row) =>
        prisma.ledgeraccount.update({
          where: { id: row.ledgerAccountId },
          data: { openingBalance: row.amount, openingBalanceSide: row.side, updatedAt: new Date() },
        }),
      ),
    );
  }

  if (booksOpeningDateStr) {
    const booksOpeningDate = new Date(booksOpeningDateStr);
    if (Number.isNaN(booksOpeningDate.getTime())) return validationError("Enter a valid opening date.");
    await prisma.company.update({ where: { id: companyId }, data: { booksOpeningDate, updatedAt: new Date() } });
  }

  const totalDebit = rows.filter((row) => row.side === "DEBIT").reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));
  const totalCredit = rows.filter((row) => row.side === "CREDIT").reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0));

  await audit({
    companyId,
    actorId: user.id,
    action: "OPENING_BALANCES_UPDATED",
    entityType: "Company",
    entityId: companyId,
    metadata: { rowCount: rows.length, totalDebit: totalDebit.toFixed(2), totalCredit: totalCredit.toFixed(2) },
  });

  revalidateAccountingPaths();

  if (rows.length && !totalDebit.equals(totalCredit)) {
    return validationError(
      `Saved, but debit and credit opening balances don't match yet (Debit ${totalDebit.toFixed(2)} vs Credit ${totalCredit.toFixed(2)}) — a real trial balance should balance to zero before you rely on these reports.`,
    );
  }
  return successState("Opening balances saved.");
}

export async function saveLedgerAccount(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("accounts:manage");
  const id = getString(formData, "id") || undefined;

  const parsed = ledgerAccountSchema.safeParse({
    id,
    ledgerGroupId: getString(formData, "ledgerGroupId"),
    name: getString(formData, "name"),
    openingBalance: getString(formData, "openingBalance") || "0",
    openingBalanceSide: getString(formData, "openingBalanceSide") || "DEBIT",
  });
  if (!parsed.success) {
    return validationError("Please fix the ledger account fields.", parsed.error.flatten().fieldErrors);
  }

  const group = await prisma.ledgergroup.findFirst({ where: { id: parsed.data.ledgerGroupId, companyId } });
  if (!group) return validationError("Select a valid ledger group.");

  const existing = id ? await prisma.ledgeraccount.findFirst({ where: { id, companyId } }) : null;
  if (id && !existing) return validationError("Ledger account was not found.");
  if (existing?.isSystemManaged) return validationError("System ledger accounts cannot be edited.");

  const now = new Date();
  try {
    const ledger = existing
      ? await prisma.ledgeraccount.update({
          where: { id: existing.id },
          data: {
            ledgerGroupId: parsed.data.ledgerGroupId,
            name: parsed.data.name,
            openingBalance: parsed.data.openingBalance,
            openingBalanceSide: parsed.data.openingBalanceSide,
            updatedAt: now,
          },
        })
      : await prisma.ledgeraccount.create({
          data: {
            id: crypto.randomUUID(),
            companyId,
            ledgerGroupId: parsed.data.ledgerGroupId,
            name: parsed.data.name,
            openingBalance: parsed.data.openingBalance,
            openingBalanceSide: parsed.data.openingBalanceSide,
            isSystemManaged: false,
            updatedAt: now,
          },
        });

    await audit({
      companyId,
      actorId: user.id,
      action: existing ? "LEDGER_ACCOUNT_UPDATED" : "LEDGER_ACCOUNT_CREATED",
      entityType: "LedgerAccount",
      entityId: ledger.id,
      metadata: { name: ledger.name },
    });

    revalidateAccountingPaths();
    return successState(existing ? "Ledger account updated." : "Ledger account created.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return validationError("A ledger account with this name already exists.", {
        name: ["Choose a unique name."],
      });
    }
    throw error;
  }
}

export async function deleteLedgerAccount(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("accounts:manage");
  const id = getString(formData, "id");
  const existing = await prisma.ledgeraccount.findFirst({ where: { id, companyId } });
  if (!existing || existing.isSystemManaged) return;

  const lineCount = await prisma.journalentryline.count({ where: { ledgerAccountId: existing.id } });
  if (lineCount > 0) return;

  await prisma.ledgeraccount.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  await audit({
    companyId,
    actorId: user.id,
    action: "LEDGER_ACCOUNT_DELETED",
    entityType: "LedgerAccount",
    entityId: existing.id,
    metadata: { name: existing.name },
  });
  revalidateAccountingPaths();
}

function parseVoucherLines(formData: FormData) {
  const ledgerAccountIds = formData.getAll("lineLedgerAccountId").map(String);
  const sides = formData.getAll("lineSide").map(String);
  const amounts = formData.getAll("lineAmount").map(String);
  const narrations = formData.getAll("lineNarration").map(String);
  return ledgerAccountIds
    .map((ledgerAccountId, index) => ({
      ledgerAccountId,
      side: sides[index] ?? "DEBIT",
      amount: amounts[index] ?? "0",
      lineNarration: narrations[index] ?? "",
    }))
    .filter((line) => line.ledgerAccountId && Number(line.amount) > 0);
}

export async function saveJournalVoucher(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("accounts:manage");

  const entryDateStr = getString(formData, "entryDate");
  const narration = getString(formData, "narration");
  const currency = getString(formData, "currency") || "BDT";
  const exchangeRateToBDT = getString(formData, "exchangeRateToBDT") || "1";
  if (!entryDateStr) return validationError("Entry date is required.");
  const entryDate = new Date(entryDateStr);
  if (Number.isNaN(entryDate.getTime())) return validationError("Enter a valid entry date.");

  const rawLines = parseVoucherLines(formData);
  if (rawLines.length < 2) return validationError("Add at least two lines (one debit, one credit).");

  const parsedLines = rawLines.map((line) => journalVoucherLineSchema.safeParse(line));
  const invalidLine = parsedLines.find((line) => !line.success);
  if (invalidLine && !invalidLine.success) {
    return validationError(invalidLine.error.issues[0]?.message ?? "Check the voucher lines.");
  }
  const lines = parsedLines.map((line) => line.data!);

  const ledgerIds = [...new Set(lines.map((line) => line.ledgerAccountId))];
  const ledgers = await prisma.ledgeraccount.findMany({
    where: { id: { in: ledgerIds }, companyId, deletedAt: null },
  });
  if (ledgers.length !== ledgerIds.length) {
    return validationError("One or more selected ledger accounts are invalid.");
  }

  try {
    const journalEntryId = await prisma.$transaction(
      (tx) =>
        syncJournalEntry(tx, {
          companyId,
          entryDate,
          voucherType: "JOURNAL",
          narration: narration || null,
          sourceType: "MANUAL_VOUCHER",
          sourceId: crypto.randomUUID(),
          createdById: user.id,
          currency,
          exchangeRateToBDT,
          lines: lines.map((line) => ({
            ledgerAccountId: line.ledgerAccountId,
            side: line.side,
            amount: line.amount,
            lineNarration: line.lineNarration || null,
          })),
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    if (!journalEntryId) return validationError("Could not post the journal voucher.");

    await audit({
      companyId,
      actorId: user.id,
      action: "JOURNAL_VOUCHER_CREATED",
      entityType: "JournalEntry",
      entityId: journalEntryId,
      metadata: { narration },
    });
    revalidateAccountingPaths();
    return successState("Journal voucher posted.");
  } catch (error) {
    if (error instanceof JournalPostingError) return validationError(error.message);
    throw error;
  }
}
