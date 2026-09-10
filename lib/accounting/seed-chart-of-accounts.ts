import { randomUUID } from "node:crypto";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

type LedgerGroupDefinition = {
  name: string;
  natureType: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  normalBalance: "DEBIT" | "CREDIT";
  isDirect: boolean;
  sortOrder: number;
};

export const LEDGER_GROUP_DEFINITIONS: LedgerGroupDefinition[] = [
  { name: "Accounts Receivable - Sundry Debtors", natureType: "ASSET", normalBalance: "DEBIT", isDirect: false, sortOrder: 10 },
  { name: "Bank Accounts", natureType: "ASSET", normalBalance: "DEBIT", isDirect: false, sortOrder: 20 },
  { name: "Cash-in-Hand", natureType: "ASSET", normalBalance: "DEBIT", isDirect: false, sortOrder: 30 },
  { name: "Current Assets", natureType: "ASSET", normalBalance: "DEBIT", isDirect: false, sortOrder: 40 },
  { name: "Fixed Assets", natureType: "ASSET", normalBalance: "DEBIT", isDirect: false, sortOrder: 50 },
  { name: "Investments", natureType: "ASSET", normalBalance: "DEBIT", isDirect: false, sortOrder: 60 },
  { name: "Accounts Payable - Sundry Creditors", natureType: "LIABILITY", normalBalance: "CREDIT", isDirect: false, sortOrder: 70 },
  { name: "Current Liabilities", natureType: "LIABILITY", normalBalance: "CREDIT", isDirect: false, sortOrder: 80 },
  { name: "Loans (Liabilities)", natureType: "LIABILITY", normalBalance: "CREDIT", isDirect: false, sortOrder: 90 },
  { name: "Provisions", natureType: "LIABILITY", normalBalance: "CREDIT", isDirect: false, sortOrder: 100 },
  { name: "Capital Account", natureType: "EQUITY", normalBalance: "CREDIT", isDirect: false, sortOrder: 110 },
  { name: "Reserves & Surplus", natureType: "EQUITY", normalBalance: "CREDIT", isDirect: false, sortOrder: 120 },
  { name: "Direct Income", natureType: "INCOME", normalBalance: "CREDIT", isDirect: true, sortOrder: 130 },
  { name: "Indirect Income", natureType: "INCOME", normalBalance: "CREDIT", isDirect: false, sortOrder: 140 },
  { name: "Foreign Exchange Gain/Loss", natureType: "INCOME", normalBalance: "CREDIT", isDirect: false, sortOrder: 150 },
  { name: "Direct Expenses", natureType: "EXPENSE", normalBalance: "DEBIT", isDirect: true, sortOrder: 160 },
  { name: "Indirect Expenses", natureType: "EXPENSE", normalBalance: "DEBIT", isDirect: false, sortOrder: 170 },
];

export const SUNDRY_DEBTORS_GROUP_NAME = "Accounts Receivable - Sundry Debtors";
export const SUNDRY_CREDITORS_GROUP_NAME = "Accounts Payable - Sundry Creditors";
export const DIRECT_INCOME_GROUP_NAME = "Direct Income";
export const DIRECT_EXPENSE_GROUP_NAME = "Direct Expenses";
export const CASH_GROUP_NAME = "Cash-in-Hand";
export const BANK_GROUP_NAME = "Bank Accounts";
export const CASH_LEDGER_NAME = "Cash Account";
export const BANK_LEDGER_NAME = "Bank Account";

type TransportMode = "SEA" | "AIR" | "LAND";
type ShipmentType = "IMPORT" | "EXPORT";

const TRANSPORT_MODE_LABEL: Record<TransportMode, string> = { SEA: "Sea", AIR: "Air", LAND: "Land" };
const SHIPMENT_TYPE_LABEL: Record<ShipmentType, string> = { IMPORT: "Import", EXPORT: "Export" };

/**
 * Ledger account name for a job-category direct income/expense line, e.g.
 * "Air-Export-Income" — mirrors the client's sample P&L naming exactly.
 * Falls back to a generic "Other-Direct-Income/Expense" ledger when the
 * source document isn't linked to a shipment job (so transport/shipment
 * type is unknown), or is a LAND job (not in the client's samples but the
 * app tracks it, so it still needs somewhere to post).
 */
export function directLedgerAccountName(
  transportMode: TransportMode | null | undefined,
  shipmentType: ShipmentType | null | undefined,
  kind: "Income" | "Expense",
): string {
  if (!transportMode || !shipmentType) return `Other-Direct-${kind}`;
  return `${TRANSPORT_MODE_LABEL[transportMode]}-${SHIPMENT_TYPE_LABEL[shipmentType]}-${kind}`;
}

const DIRECT_LEDGER_NAMES: string[] = (() => {
  const modes: TransportMode[] = ["SEA", "AIR", "LAND"];
  const types: ShipmentType[] = ["IMPORT", "EXPORT"];
  const names: string[] = [];
  for (const kind of ["Income", "Expense"] as const) {
    names.push(`Other-Direct-${kind}`);
    for (const mode of modes) {
      for (const type of types) {
        names.push(directLedgerAccountName(mode, type, kind));
      }
    }
  }
  return names;
})();

/**
 * Creates the 17 canonical ledger groups for a company, plus the system
 * ledger accounts needed by the auto-posting engine (job-category direct
 * income/expense ledgers, and a catch-all cash/bank ledger). Safe to call
 * more than once (relies on the @@unique([companyId, name]) constraints) —
 * anything already present is left untouched, only what's missing is added.
 */
export async function seedDefaultChartOfAccounts(companyId: string, db: Db = prisma): Promise<void> {
  const now = new Date();
  await db.ledgergroup.createMany({
    data: LEDGER_GROUP_DEFINITIONS.map((group) => ({
      id: randomUUID(),
      companyId,
      name: group.name,
      natureType: group.natureType,
      normalBalance: group.normalBalance,
      isDirect: group.isDirect,
      isSystemManaged: true,
      sortOrder: group.sortOrder,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });

  const groups = await db.ledgergroup.findMany({
    where: {
      companyId,
      name: { in: [DIRECT_INCOME_GROUP_NAME, DIRECT_EXPENSE_GROUP_NAME, CASH_GROUP_NAME, BANK_GROUP_NAME] },
    },
    select: { id: true, name: true },
  });
  const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));

  const systemLedgerAccounts: { name: string; groupName: string }[] = [
    ...DIRECT_LEDGER_NAMES.map((name) => ({
      name,
      groupName: name.endsWith("Income") ? DIRECT_INCOME_GROUP_NAME : DIRECT_EXPENSE_GROUP_NAME,
    })),
    { name: CASH_LEDGER_NAME, groupName: CASH_GROUP_NAME },
    { name: BANK_LEDGER_NAME, groupName: BANK_GROUP_NAME },
  ];

  await db.ledgeraccount.createMany({
    data: systemLedgerAccounts
      .filter((account) => groupIdByName.has(account.groupName))
      .map((account) => ({
        id: randomUUID(),
        companyId,
        ledgerGroupId: groupIdByName.get(account.groupName)!,
        name: account.name,
        isSystemManaged: true,
        updatedAt: now,
      })),
    skipDuplicates: true,
  });
}

/**
 * Idempotent get-or-create for any named system ledger account under a given
 * group. Used by the posting engine to self-heal (auto-vivify) a missing
 * ledger account rather than fail a business transaction because seeding
 * hasn't been re-run since this account name was introduced. Accepts a `db`
 * argument so it can run inside an existing transaction when called from the
 * posting engine, keeping the ledger lookup/creation atomic with the
 * business write it's supporting.
 */
export async function ensureNamedLedgerAccount(
  companyId: string,
  groupName: string,
  ledgerName: string,
  db: Db = prisma,
): Promise<string | null> {
  const existing = await db.ledgeraccount.findUnique({
    where: { companyId_name: { companyId, name: ledgerName } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const group = await db.ledgergroup.findUnique({
    where: { companyId_name: { companyId, name: groupName } },
    select: { id: true },
  });
  if (!group) return null;

  const now = new Date();
  try {
    const created = await db.ledgeraccount.create({
      data: {
        id: randomUUID(),
        companyId,
        ledgerGroupId: group.id,
        name: ledgerName,
        isSystemManaged: true,
        updatedAt: now,
      },
    });
    return created.id;
  } catch {
    const raced = await db.ledgeraccount.findUnique({
      where: { companyId_name: { companyId, name: ledgerName } },
      select: { id: true },
    });
    return raced?.id ?? null;
  }
}

export async function isChartOfAccountsInitialized(companyId: string, db: Db = prisma): Promise<boolean> {
  const count = await db.ledgergroup.count({ where: { companyId } });
  return count > 0;
}

/**
 * Idempotent get-or-create for a customer's Sundry Debtor ledger. Returns null
 * (never throws) when the company hasn't initialized its chart of accounts yet,
 * so companies not opted into accounting are completely unaffected.
 */
export async function ensureCustomerLedgerAccount(
  companyId: string,
  customerId: string,
  customerName: string,
  db: Db = prisma,
): Promise<string | null> {
  const existing = await db.ledgeraccount.findUnique({
    where: { linkedCustomerId: customerId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const group = await db.ledgergroup.findUnique({
    where: { companyId_name: { companyId, name: SUNDRY_DEBTORS_GROUP_NAME } },
    select: { id: true },
  });
  if (!group) return null;

  const now = new Date();
  const created = await db.ledgeraccount.create({
    data: {
      id: randomUUID(),
      companyId,
      ledgerGroupId: group.id,
      name: customerName,
      linkedCustomerId: customerId,
      isSystemManaged: true,
      updatedAt: now,
    },
  });
  return created.id;
}

/**
 * Idempotent get-or-create for a vendor's Sundry Creditor ledger. Returns null
 * (never throws) when the company hasn't initialized its chart of accounts yet.
 */
export async function ensureVendorLedgerAccount(
  companyId: string,
  vendorId: string,
  vendorName: string,
  db: Db = prisma,
): Promise<string | null> {
  const existing = await db.ledgeraccount.findUnique({
    where: { linkedVendorId: vendorId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const group = await db.ledgergroup.findUnique({
    where: { companyId_name: { companyId, name: SUNDRY_CREDITORS_GROUP_NAME } },
    select: { id: true },
  });
  if (!group) return null;

  const now = new Date();
  const created = await db.ledgeraccount.create({
    data: {
      id: randomUUID(),
      companyId,
      ledgerGroupId: group.id,
      name: vendorName,
      linkedVendorId: vendorId,
      isSystemManaged: true,
      updatedAt: now,
    },
  });
  return created.id;
}
