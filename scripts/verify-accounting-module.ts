/**
 * Standalone smoke test for the accounting module (Phases 1-6): Chart of
 * Accounts, journal posting engine, Trial Balance/P&L/Balance Sheet math,
 * multi-currency conversion, idempotency, and company isolation.
 *
 * Run any time after a change to lib/accounting/**, lib/reports/{trial-balance,
 * profit-loss,balance-sheet,accounting-summary}.ts, or the billing.ts posting
 * hooks, to confirm the double-entry engine is still internally consistent.
 * This does NOT go through HTTP/session auth (it calls the posting engine
 * directly with fabricated data) — it is a math/engine correctness check,
 * not an RBAC or UI check. Pair with `npm run test:e2e` for those.
 *
 * Usage: npx tsx scripts/verify-accounting-module.ts
 *
 * All data created is prefixed "SMOKE-" or company-scoped to existing demo
 * fixtures and is deleted again at the end, regardless of pass/fail.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  postInvoiceSentEntry,
  reverseInvoiceEntry,
  postVendorBillReceivedEntry,
  postPaymentEntry,
} from "@/lib/accounting/billing-hooks";
import { syncJournalEntry, JournalPostingError } from "@/lib/accounting/posting";
import { getRateToUSD, upsertExchangeRate } from "@/lib/accounting/exchange-rates";
import { ensureNamedLedgerAccount, BANK_GROUP_NAME, BANK_LEDGER_NAME } from "@/lib/accounting/seed-chart-of-accounts";
import { getLedgerBalances } from "@/lib/reports/accounting-summary";

let passCount = 0;
let failCount = 0;
function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passCount += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failCount += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const company = await prisma.company.findFirst({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  const customer = await prisma.customer.findFirst({ where: { companyId: company!.id, deletedAt: null } });
  const vendor = await prisma.vendor.findFirst({ where: { companyId: company!.id, deletedAt: null } });
  const user = await prisma.user.findFirst({ where: { companyId: company!.id, scope: "COMPANY" } });
  const untouchedCompany = await prisma.company.findFirst({ where: { deletedAt: null, id: { not: company!.id } } });
  if (!company || !customer || !vendor || !user) {
    console.log("Missing baseline fixtures (need at least one company with a customer, vendor, and user) — cannot run.");
    process.exit(1);
  }

  console.log(`Using company: ${company.name} (${company.id})\n`);

  const originalBaseCurrency = company.baseCurrency;
  const cleanupJournalEntryIds: string[] = [];
  const cleanupLedgerAccountIds: string[] = [];
  const cleanupExchangeRates: { currency: string; effectiveDate: Date }[] = [];

  try {
    // ---------------------------------------------------------------
    // 1. Control totals across a full mixed lifecycle
    // ---------------------------------------------------------------
    console.log("1. Control totals (invoice + vendor bill + payment + manual voucher)");
    const invoiceId = randomUUID();
    const billId = randomUUID();
    const paymentId = randomUUID();
    const voucherSourceId = randomUUID();

    await prisma.$transaction((tx) =>
      postInvoiceSentEntry(
        tx,
        {
          id: invoiceId,
          companyId: company.id,
          customerId: customer.id,
          shipmentJobId: null,
          currency: "BDT",
          exchangeRateToBDT: new Prisma.Decimal(1),
          totalAmount: new Prisma.Decimal(10000),
          invoiceNo: "SMOKE-INV",
          invoiceDate: new Date("2025-06-01"),
        },
        user.id,
      ),
    );
    await prisma.$transaction((tx) =>
      postVendorBillReceivedEntry(
        tx,
        {
          id: billId,
          companyId: company.id,
          vendorId: vendor.id,
          shipmentJobId: null,
          currency: "BDT",
          exchangeRateToBDT: new Prisma.Decimal(1),
          totalAmount: new Prisma.Decimal(4000),
          billNo: "SMOKE-VB",
          billDate: new Date("2025-06-02"),
        },
        user.id,
      ),
    );
    await prisma.$transaction((tx) =>
      postPaymentEntry(
        tx,
        {
          id: paymentId,
          companyId: company.id,
          direction: "RECEIVED",
          customerId: customer.id,
          vendorId: null,
          paymentMethod: "CASH",
          currency: "BDT",
          exchangeRateToBDT: new Prisma.Decimal(1),
          amount: new Prisma.Decimal(3000),
          paymentNo: "SMOKE-PAY",
          paymentDate: new Date("2025-06-03"),
        },
        user.id,
      ),
    );

    const capitalGroup = await prisma.ledgergroup.findUnique({ where: { companyId_name: { companyId: company.id, name: "Capital Account" } } });
    const capitalLedger = await prisma.ledgeraccount.create({
      data: { id: randomUUID(), companyId: company.id, ledgerGroupId: capitalGroup!.id, name: "SMOKE Share Capital", updatedAt: new Date() },
    });
    cleanupLedgerAccountIds.push(capitalLedger.id);
    const bankLedgerId = await ensureNamedLedgerAccount(company.id, BANK_GROUP_NAME, BANK_LEDGER_NAME);
    await prisma.$transaction((tx) =>
      syncJournalEntry(tx, {
        companyId: company.id,
        entryDate: new Date("2025-06-04"),
        voucherType: "JOURNAL",
        narration: "SMOKE capital injection",
        sourceType: "MANUAL_VOUCHER",
        sourceId: voucherSourceId,
        createdById: user.id,
        currency: "BDT",
        exchangeRateToBDT: 1,
        lines: [
          { ledgerAccountId: bankLedgerId!, side: "DEBIT", amount: 50000 },
          { ledgerAccountId: capitalLedger.id, side: "CREDIT", amount: 50000 },
        ],
      }),
    );

    const range = { from: new Date("2020-01-01"), to: new Date("2035-12-31") };
    const { rows: tbRows } = await getLedgerBalances(company.id, range, { includeOpeningBalance: true });
    const totalDebit = tbRows.reduce((s, r) => s + r.debit, 0);
    const totalCredit = tbRows.reduce((s, r) => s + r.credit, 0);
    check("Trial Balance: total debit equals total credit", Math.abs(totalDebit - totalCredit) < 0.01, `${totalDebit} vs ${totalCredit}`);

    const { rows: plRows } = await getLedgerBalances(company.id, range, { includeOpeningBalance: false });
    const directIncome = plRows.filter((r) => r.natureType === "INCOME" && r.isDirect).reduce((s, r) => s + r.credit, 0);
    const directExpense = plRows.filter((r) => r.natureType === "EXPENSE" && r.isDirect).reduce((s, r) => s + r.debit, 0);
    const netProfit = directIncome - directExpense; // no indirect activity in this smoke run
    check("P&L: Gross/Net profit = Direct Income - Direct Expense (10000-4000=6000)", netProfit === 6000, `got ${netProfit}`);

    const assetTotal = tbRows.filter((r) => r.natureType === "ASSET").reduce((s, r) => s + r.debit - r.credit, 0);
    const liabEqTotal = tbRows.filter((r) => r.natureType === "LIABILITY" || r.natureType === "EQUITY").reduce((s, r) => s + r.credit - r.debit, 0) + netProfit;
    check("Balance Sheet: Assets = Liabilities + Equity + Net Profit", Math.abs(assetTotal - liabEqTotal) < 0.01, `${assetTotal} vs ${liabEqTotal}`);

    cleanupJournalEntryIds.push(invoiceId, billId, paymentId, voucherSourceId);

    // ---------------------------------------------------------------
    // 2. Idempotency: re-posting the same source must not duplicate
    // ---------------------------------------------------------------
    console.log("\n2. Idempotency (same source posted twice, e.g. an approval-flow retry)");
    await prisma.$transaction((tx) =>
      postInvoiceSentEntry(
        tx,
        {
          id: invoiceId,
          companyId: company.id,
          customerId: customer.id,
          shipmentJobId: null,
          currency: "BDT",
          exchangeRateToBDT: new Prisma.Decimal(1),
          totalAmount: new Prisma.Decimal(10000),
          invoiceNo: "SMOKE-INV",
          invoiceDate: new Date("2025-06-01"),
        },
        user.id,
      ),
    );
    const entryCountAfterRetry = await prisma.journalentry.count({ where: { companyId: company.id, sourceType: "INVOICE_SENT", sourceId: invoiceId } });
    check("Re-posting the same invoice source does not create a duplicate entry", entryCountAfterRetry === 1, `found ${entryCountAfterRetry}`);

    // ---------------------------------------------------------------
    // 3. Reversal + double-reversal idempotency
    // ---------------------------------------------------------------
    console.log("\n3. Reversal correctness");
    await prisma.$transaction((tx) => reverseInvoiceEntry(tx, { companyId: company.id, invoiceId }, user.id));
    await prisma.$transaction((tx) => reverseInvoiceEntry(tx, { companyId: company.id, invoiceId }, user.id));
    const original = await prisma.journalentry.findFirst({ where: { companyId: company.id, sourceType: "INVOICE_SENT", sourceId: invoiceId } });
    const reversalCount = await prisma.journalentry.count({ where: { companyId: company.id, sourceType: "REVERSAL", sourceId: original?.id } });
    check("Reversing twice only creates one reversal entry", reversalCount === 1, `found ${reversalCount}`);
    check("Original entry is marked reversed", !!original?.reversedByEntryId);

    // ---------------------------------------------------------------
    // 4. Unbalanced entry rejection
    // ---------------------------------------------------------------
    console.log("\n4. Balance validation");
    let rejected = false;
    try {
      await prisma.$transaction((tx) =>
        syncJournalEntry(tx, {
          companyId: company.id,
          entryDate: new Date(),
          voucherType: "JOURNAL",
          sourceType: "SMOKE_UNBALANCED",
          sourceId: randomUUID(),
          createdById: user.id,
          currency: "BDT",
          exchangeRateToBDT: 1,
          lines: [
            { ledgerAccountId: capitalLedger.id, side: "DEBIT", amount: 100 },
            { ledgerAccountId: bankLedgerId!, side: "CREDIT", amount: 50 },
          ],
        }),
      );
    } catch (error) {
      rejected = error instanceof JournalPostingError;
    }
    check("An unbalanced journal entry is rejected", rejected);

    // ---------------------------------------------------------------
    // 5. Multi-currency conversion
    // ---------------------------------------------------------------
    console.log("\n5. Multi-currency (AED base company + rate lookup)");
    await upsertExchangeRate({ currency: "AED", rateToUSD: 0.272, effectiveDate: new Date("2025-01-01") });
    cleanupExchangeRates.push({ currency: "AED", effectiveDate: new Date("2025-01-01") });
    await prisma.company.update({ where: { id: company.id }, data: { baseCurrency: "AED" } });

    const aedInvoiceId = randomUUID();
    await prisma.$transaction((tx) =>
      postInvoiceSentEntry(
        tx,
        {
          id: aedInvoiceId,
          companyId: company.id,
          customerId: customer.id,
          shipmentJobId: null,
          currency: "AED",
          exchangeRateToBDT: new Prisma.Decimal(30),
          totalAmount: new Prisma.Decimal(1000),
          invoiceNo: "SMOKE-INV-AED",
          invoiceDate: new Date("2025-06-15"),
        },
        user.id,
      ),
    );
    cleanupJournalEntryIds.push(aedInvoiceId);
    const aedLine = await prisma.journalentryline.findFirst({
      where: { journalentry: { sourceType: "INVOICE_SENT", sourceId: aedInvoiceId }, side: "DEBIT" },
    });
    check("AED invoice line uses the on-file rate (0.272)", aedLine?.rateToUSD.toString() === "0.272000" || Number(aedLine?.rateToUSD) === 0.272, String(aedLine?.rateToUSD));
    check("AED 1000 converts to USD 272.00", Number(aedLine?.amountUSD) === 272, String(aedLine?.amountUSD));

    await prisma.company.update({ where: { id: company.id }, data: { baseCurrency: originalBaseCurrency } });

    // ---------------------------------------------------------------
    // 6. Company isolation — a company with no chart of accounts is untouched
    // ---------------------------------------------------------------
    console.log("\n6. Company isolation");
    if (untouchedCompany) {
      const isolatedInvoiceId = randomUUID();
      const untouchedGroupCountBefore = await prisma.ledgergroup.count({ where: { companyId: untouchedCompany.id } });
      if (untouchedGroupCountBefore === 0) {
        await prisma.$transaction((tx) =>
          postInvoiceSentEntry(
            tx,
            {
              id: isolatedInvoiceId,
              companyId: untouchedCompany.id,
              customerId: customer.id,
              shipmentJobId: null,
              currency: "BDT",
              exchangeRateToBDT: new Prisma.Decimal(1),
              totalAmount: new Prisma.Decimal(500),
              invoiceNo: "SMOKE-SHOULD-NOT-POST",
              invoiceDate: new Date(),
            },
            user.id,
          ),
        );
        const entryCount = await prisma.journalentry.count({ where: { companyId: untouchedCompany.id } });
        check(`Company without an initialized chart of accounts (${untouchedCompany.name}) stays untouched`, entryCount === 0, `found ${entryCount}`);
      } else {
        console.log(`  SKIP  ${untouchedCompany.name} already has a chart of accounts initialized — nothing to prove here.`);
      }
    } else {
      console.log("  SKIP  no second company available to test isolation against.");
    }
  } finally {
    // -----------------------------------------------------------------
    // Cleanup — always run, regardless of pass/fail above
    // -----------------------------------------------------------------
    console.log("\nCleaning up smoke-test data...");
    const entries = await prisma.journalentry.findMany({
      where: { companyId: company!.id, sourceId: { in: cleanupJournalEntryIds } },
      select: { id: true },
    });
    const reversals = await prisma.journalentry.findMany({
      where: { companyId: company!.id, sourceType: "REVERSAL", sourceId: { in: entries.map((e) => e.id) } },
      select: { id: true },
    });
    const unbalancedAttempt = await prisma.journalentry.findMany({
      where: { companyId: company!.id, sourceType: "SMOKE_UNBALANCED" },
      select: { id: true },
    });
    const allEntryIds = [...entries.map((e) => e.id), ...reversals.map((r) => r.id), ...unbalancedAttempt.map((u) => u.id)];
    await prisma.journalentryline.deleteMany({ where: { journalEntryId: { in: allEntryIds } } });
    await prisma.journalentry.deleteMany({ where: { id: { in: allEntryIds } } });
    if (cleanupLedgerAccountIds.length) {
      await prisma.ledgeraccount.deleteMany({ where: { id: { in: cleanupLedgerAccountIds } } });
    }
    for (const rate of cleanupExchangeRates) {
      await prisma.exchangerate.deleteMany({ where: { currency: rate.currency as never, effectiveDate: rate.effectiveDate } });
    }
    await prisma.company.update({ where: { id: company!.id }, data: { baseCurrency: originalBaseCurrency } });
    console.log("Done.");
  }

  console.log(`\n${"=".repeat(50)}\n${passCount} passed, ${failCount} failed\n${"=".repeat(50)}`);
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
