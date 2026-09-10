import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getRateToUSD } from "@/lib/accounting/exchange-rates";
import type { ReportSearchParams } from "@/lib/reports/date-range";

/**
 * Trial Balance / P&L / Balance Sheet are cumulative-since-inception
 * reports, not bounded operational windows — so when the caller hasn't
 * picked an explicit "from" date, default it to the company's configured
 * `booksOpeningDate` (the date its opening balances are as of) rather than
 * the generic "last 30 days" every other report defaults to. Without this,
 * picking any date range that doesn't start exactly on the opening date
 * would silently omit the movement in between.
 */
export async function applyBooksOpeningDateDefault(
  companyId: string,
  params: ReportSearchParams,
  range: { from: Date; to: Date; fromInput: string; toInput: string },
) {
  if (params.from) return range;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { booksOpeningDate: true } });
  if (!company?.booksOpeningDate) return range;
  // Parse via the same "YYYY-MM-DDT00:00:00" (local-midnight, no UTC "Z")
  // convention getReportDateRange's own validDate() uses — going through
  // Date -> setHours(0,0,0,0) directly would shift the calendar date
  // backward whenever the server's local timezone is behind UTC.
  const fromInput = company.booksOpeningDate.toISOString().slice(0, 10);
  const from = new Date(`${fromInput}T00:00:00`);
  if (from >= range.to) return range;
  return { ...range, from, fromInput };
}

export type LedgerBalanceRow = {
  ledgerAccountId: string;
  ledgerName: string;
  groupId: string;
  groupName: string;
  natureType: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
  isDirect: boolean;
  sortOrder: number;
  debit: number;
  credit: number;
  debitUSD: number;
  creditUSD: number;
  debitBDT: number;
  creditBDT: number;
};

export type LedgerGroupSummary = {
  groupId: string;
  groupName: string;
  natureType: LedgerBalanceRow["natureType"];
  sortOrder: number;
  rows: LedgerBalanceRow[];
  subtotalDebit: number;
  subtotalCredit: number;
  subtotalDebitUSD: number;
  subtotalCreditUSD: number;
  subtotalDebitBDT: number;
  subtotalCreditBDT: number;
};

/**
 * Per-ledger closing balance for [from, to]: opening balance (when
 * `includeOpeningBalance` is true — used for Trial Balance / Balance Sheet,
 * which carry forward) plus the net movement from journal lines posted in
 * range. P&L accounts (Income/Expense) reset each period, so their callers
 * pass `includeOpeningBalance: false`.
 *
 * Every row carries the company's own base-currency figure (debit/credit)
 * plus two more currencies computed from each line's snapshot: USD
 * (debitUSD/creditUSD, from `amountUSD`) and BDT (debitBDT/creditBDT, from
 * `amountBDT` — the document-native BDT conversion already trusted
 * elsewhere in the app, more accurate than a USD cross-rate). The normal
 * (non-audit) report view only shows base-currency + USD; the audit/
 * switched-company view additionally shows BDT, since that's the fixed HQ
 * reporting currency regardless of which company is being audited.
 *
 * Opening balances (no per-line snapshot) are translated using the
 * company's base-currency rate as of the period end (closing-rate
 * translation) for USD, and cross-rated through USD for BDT.
 *
 * Reversal entries are summed like any other entry — a reversed original
 * and its mirror both land inside the same sum and net out correctly, no
 * special-casing needed.
 */
export async function getLedgerBalances(
  companyId: string,
  range: { from: Date; to: Date },
  opts: { includeOpeningBalance: boolean },
): Promise<{ baseCurrency: string; rows: LedgerBalanceRow[] }> {
  const [company, ledgerAccounts, movements] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { baseCurrency: true } }),
    prisma.ledgeraccount.findMany({
      where: { companyId, deletedAt: null },
      include: { ledgergroup: true },
      orderBy: [{ ledgergroup: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.journalentryline.groupBy({
      by: ["ledgerAccountId", "side"],
      where: {
        ledgeraccount: { companyId },
        journalentry: { entryDate: { gte: range.from, lte: range.to } },
      },
      _sum: { nativeAmount: true, amountUSD: true, amountBDT: true },
    }),
  ]);

  const baseCurrency = company?.baseCurrency ?? "BDT";
  const [closingRateToUSD, bdtRateToUSD] = await Promise.all([
    getRateToUSD(baseCurrency, range.to).then(Number),
    getRateToUSD("BDT", range.to).then(Number),
  ]);
  const closingRateToBDT = bdtRateToUSD > 0 ? closingRateToUSD / bdtRateToUSD : closingRateToUSD;

  // "debit"/"credit" below must be the amount in the company's OWN base
  // currency, not the raw native amount — a line posted in a different
  // currency (e.g. a USD invoice for a BDT-base company) would otherwise
  // have its native figure (10) summed as if it were already BDT, instead
  // of the correctly-converted amount (1,200). amountBDT/amountUSD are
  // exact per-line snapshots (Phase 4), so use whichever matches the
  // company's base currency exactly; any other base currency falls back to
  // a period-closing-rate approximation via USD (same simplification the
  // opening-balance translation below already relies on).
  const amountInBaseCurrency = (sum: { amountUSD: Prisma.Decimal | null; amountBDT: Prisma.Decimal | null }) => {
    if (baseCurrency === "BDT") return Number(sum.amountBDT ?? 0);
    if (baseCurrency === "USD") return Number(sum.amountUSD ?? 0);
    const usd = Number(sum.amountUSD ?? 0);
    return closingRateToUSD > 0 ? usd / closingRateToUSD : usd;
  };

  const movementByLedger = new Map<
    string,
    { debit: number; credit: number; debitUSD: number; creditUSD: number; debitBDT: number; creditBDT: number }
  >();
  for (const movement of movements) {
    const entry =
      movementByLedger.get(movement.ledgerAccountId) ?? { debit: 0, credit: 0, debitUSD: 0, creditUSD: 0, debitBDT: 0, creditBDT: 0 };
    const amount = amountInBaseCurrency(movement._sum);
    const amountUSD = Number(movement._sum.amountUSD ?? 0);
    const amountBDT = Number(movement._sum.amountBDT ?? 0);
    if (movement.side === "DEBIT") {
      entry.debit += amount;
      entry.debitUSD += amountUSD;
      entry.debitBDT += amountBDT;
    } else {
      entry.credit += amount;
      entry.creditUSD += amountUSD;
      entry.creditBDT += amountBDT;
    }
    movementByLedger.set(movement.ledgerAccountId, entry);
  }

  const rows = ledgerAccounts
    .map((account) => {
      const movement =
        movementByLedger.get(account.id) ?? { debit: 0, credit: 0, debitUSD: 0, creditUSD: 0, debitBDT: 0, creditBDT: 0 };
      const openingNative = opts.includeOpeningBalance ? Number(account.openingBalance) : 0;
      const openingSigned = account.openingBalanceSide === "DEBIT" ? openingNative : -openingNative;
      const openingSignedUSD = openingSigned * closingRateToUSD;
      const openingSignedBDT = openingSigned * closingRateToBDT;

      const net = openingSigned + movement.debit - movement.credit;
      const netUSD = openingSignedUSD + movement.debitUSD - movement.creditUSD;
      const netBDT = openingSignedBDT + movement.debitBDT - movement.creditBDT;

      return {
        ledgerAccountId: account.id,
        ledgerName: account.name,
        groupId: account.ledgerGroupId,
        groupName: account.ledgergroup.name,
        natureType: account.ledgergroup.natureType,
        isDirect: account.ledgergroup.isDirect,
        sortOrder: account.ledgergroup.sortOrder,
        debit: net > 0 ? net : 0,
        credit: net < 0 ? -net : 0,
        debitUSD: netUSD > 0 ? netUSD : 0,
        creditUSD: netUSD < 0 ? -netUSD : 0,
        debitBDT: netBDT > 0 ? netBDT : 0,
        creditBDT: netBDT < 0 ? -netBDT : 0,
        hasActivity: movement.debit !== 0 || movement.credit !== 0 || openingNative !== 0,
      };
    })
    .filter((row) => row.hasActivity)
    .map(({ hasActivity, ...row }) => row);

  return { baseCurrency, rows };
}

export function groupByLedgerGroup(rows: LedgerBalanceRow[]): LedgerGroupSummary[] {
  const map = new Map<string, LedgerGroupSummary>();
  for (const row of rows) {
    const existing = map.get(row.groupId) ?? {
      groupId: row.groupId,
      groupName: row.groupName,
      natureType: row.natureType,
      sortOrder: row.sortOrder,
      rows: [],
      subtotalDebit: 0,
      subtotalCredit: 0,
      subtotalDebitUSD: 0,
      subtotalCreditUSD: 0,
      subtotalDebitBDT: 0,
      subtotalCreditBDT: 0,
    };
    existing.rows.push(row);
    existing.subtotalDebit += row.debit;
    existing.subtotalCredit += row.credit;
    existing.subtotalDebitUSD += row.debitUSD;
    existing.subtotalCreditUSD += row.creditUSD;
    existing.subtotalDebitBDT += row.debitBDT;
    existing.subtotalCreditBDT += row.creditBDT;
    map.set(row.groupId, existing);
  }
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}
