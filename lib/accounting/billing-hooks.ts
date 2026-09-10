import type { Prisma } from "@/lib/generated/prisma/client";
import { syncJournalEntry, reverseJournalEntry } from "@/lib/accounting/posting";
import {
  DIRECT_INCOME_GROUP_NAME,
  DIRECT_EXPENSE_GROUP_NAME,
  CASH_GROUP_NAME,
  BANK_GROUP_NAME,
  CASH_LEDGER_NAME,
  BANK_LEDGER_NAME,
  directLedgerAccountName,
  ensureNamedLedgerAccount,
  ensureCustomerLedgerAccount,
  ensureVendorLedgerAccount,
  isChartOfAccountsInitialized,
} from "@/lib/accounting/seed-chart-of-accounts";

// Every function in this file is a best-effort side effect of a billing
// action (invoice sent, bill received, payment recorded/deleted). None of
// them may ever throw out to the caller — a ledger-posting problem must
// never block the underlying business action, which already worked fine
// before this accounting module existed.

async function resolveJobCategory(tx: Prisma.TransactionClient, shipmentJobId: string | null) {
  if (!shipmentJobId) return null;
  return tx.shipmentjob.findUnique({
    where: { id: shipmentJobId },
    select: { transportMode: true, shipmentType: true },
  });
}

export async function postInvoiceSentEntry(
  tx: Prisma.TransactionClient,
  invoice: {
    id: string;
    companyId: string;
    customerId: string;
    shipmentJobId: string | null;
    currency: string;
    exchangeRateToBDT: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    invoiceNo: string;
    invoiceDate: Date;
  },
  actorId: string,
): Promise<void> {
  try {
    if (invoice.totalAmount.lessThanOrEqualTo(0)) return;
    if (!(await isChartOfAccountsInitialized(invoice.companyId, tx))) return;

    const customer = await tx.customer.findUnique({ where: { id: invoice.customerId }, select: { name: true } });
    if (!customer) return;
    const customerLedgerId = await ensureCustomerLedgerAccount(invoice.companyId, invoice.customerId, customer.name, tx);
    if (!customerLedgerId) return;

    const job = await resolveJobCategory(tx, invoice.shipmentJobId);
    const incomeLedgerName = directLedgerAccountName(job?.transportMode, job?.shipmentType, "Income");
    const incomeLedgerId = await ensureNamedLedgerAccount(invoice.companyId, DIRECT_INCOME_GROUP_NAME, incomeLedgerName, tx);
    if (!incomeLedgerId) return;

    await syncJournalEntry(tx, {
      companyId: invoice.companyId,
      entryDate: invoice.invoiceDate,
      voucherType: "SALES",
      narration: `Invoice ${invoice.invoiceNo}`,
      sourceType: "INVOICE_SENT",
      sourceId: invoice.id,
      createdById: actorId,
      currency: invoice.currency,
      exchangeRateToBDT: invoice.exchangeRateToBDT,
      lines: [
        { ledgerAccountId: customerLedgerId, side: "DEBIT", amount: invoice.totalAmount },
        { ledgerAccountId: incomeLedgerId, side: "CREDIT", amount: invoice.totalAmount },
      ],
    });
  } catch (error) {
    console.error("Failed to post invoice journal entry", error);
  }
}

export async function reverseInvoiceEntry(
  tx: Prisma.TransactionClient,
  params: { companyId: string; invoiceId: string },
  actorId: string,
): Promise<void> {
  try {
    await reverseJournalEntry(tx, {
      companyId: params.companyId,
      sourceType: "INVOICE_SENT",
      sourceId: params.invoiceId,
      voucherType: "SALES",
      createdById: actorId,
    });
  } catch (error) {
    console.error("Failed to reverse invoice journal entry", error);
  }
}

export async function postVendorBillReceivedEntry(
  tx: Prisma.TransactionClient,
  bill: {
    id: string;
    companyId: string;
    vendorId: string;
    shipmentJobId: string | null;
    currency: string;
    exchangeRateToBDT: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    billNo: string;
    billDate: Date;
  },
  actorId: string,
): Promise<void> {
  try {
    if (bill.totalAmount.lessThanOrEqualTo(0)) return;
    if (!(await isChartOfAccountsInitialized(bill.companyId, tx))) return;

    const vendor = await tx.vendor.findUnique({ where: { id: bill.vendorId }, select: { name: true } });
    if (!vendor) return;
    const vendorLedgerId = await ensureVendorLedgerAccount(bill.companyId, bill.vendorId, vendor.name, tx);
    if (!vendorLedgerId) return;

    const job = await resolveJobCategory(tx, bill.shipmentJobId);
    const expenseLedgerName = directLedgerAccountName(job?.transportMode, job?.shipmentType, "Expense");
    const expenseLedgerId = await ensureNamedLedgerAccount(bill.companyId, DIRECT_EXPENSE_GROUP_NAME, expenseLedgerName, tx);
    if (!expenseLedgerId) return;

    await syncJournalEntry(tx, {
      companyId: bill.companyId,
      entryDate: bill.billDate,
      voucherType: "PURCHASE",
      narration: `Vendor bill ${bill.billNo}`,
      sourceType: "VENDOR_BILL_RECEIVED",
      sourceId: bill.id,
      createdById: actorId,
      currency: bill.currency,
      exchangeRateToBDT: bill.exchangeRateToBDT,
      lines: [
        { ledgerAccountId: expenseLedgerId, side: "DEBIT", amount: bill.totalAmount },
        { ledgerAccountId: vendorLedgerId, side: "CREDIT", amount: bill.totalAmount },
      ],
    });
  } catch (error) {
    console.error("Failed to post vendor bill journal entry", error);
  }
}

export async function reverseVendorBillEntry(
  tx: Prisma.TransactionClient,
  params: { companyId: string; vendorBillId: string },
  actorId: string,
): Promise<void> {
  try {
    await reverseJournalEntry(tx, {
      companyId: params.companyId,
      sourceType: "VENDOR_BILL_RECEIVED",
      sourceId: params.vendorBillId,
      voucherType: "PURCHASE",
      createdById: actorId,
    });
  } catch (error) {
    console.error("Failed to reverse vendor bill journal entry", error);
  }
}

export async function postPaymentEntry(
  tx: Prisma.TransactionClient,
  payment: {
    id: string;
    companyId: string;
    direction: "RECEIVED" | "PAID";
    customerId: string | null;
    vendorId: string | null;
    paymentMethod: string;
    currency: string;
    exchangeRateToBDT: Prisma.Decimal;
    amount: Prisma.Decimal;
    paymentNo: string;
    paymentDate: Date;
  },
  actorId: string,
): Promise<void> {
  try {
    if (payment.amount.lessThanOrEqualTo(0)) return;
    if (!(await isChartOfAccountsInitialized(payment.companyId, tx))) return;

    const cashOrBankLedgerId =
      payment.paymentMethod === "CASH"
        ? await ensureNamedLedgerAccount(payment.companyId, CASH_GROUP_NAME, CASH_LEDGER_NAME, tx)
        : await ensureNamedLedgerAccount(payment.companyId, BANK_GROUP_NAME, BANK_LEDGER_NAME, tx);
    if (!cashOrBankLedgerId) return;

    let partyLedgerId: string | null = null;
    if (payment.direction === "RECEIVED" && payment.customerId) {
      const customer = await tx.customer.findUnique({ where: { id: payment.customerId }, select: { name: true } });
      if (customer) partyLedgerId = await ensureCustomerLedgerAccount(payment.companyId, payment.customerId, customer.name, tx);
    } else if (payment.direction === "PAID" && payment.vendorId) {
      const vendor = await tx.vendor.findUnique({ where: { id: payment.vendorId }, select: { name: true } });
      if (vendor) partyLedgerId = await ensureVendorLedgerAccount(payment.companyId, payment.vendorId, vendor.name, tx);
    }
    if (!partyLedgerId) return;

    const lines =
      payment.direction === "RECEIVED"
        ? [
            { ledgerAccountId: cashOrBankLedgerId, side: "DEBIT" as const, amount: payment.amount },
            { ledgerAccountId: partyLedgerId, side: "CREDIT" as const, amount: payment.amount },
          ]
        : [
            { ledgerAccountId: partyLedgerId, side: "DEBIT" as const, amount: payment.amount },
            { ledgerAccountId: cashOrBankLedgerId, side: "CREDIT" as const, amount: payment.amount },
          ];

    await syncJournalEntry(tx, {
      companyId: payment.companyId,
      entryDate: payment.paymentDate,
      voucherType: payment.direction === "RECEIVED" ? "RECEIPT" : "PAYMENT",
      narration: `Payment ${payment.paymentNo}`,
      sourceType: "PAYMENT",
      sourceId: payment.id,
      createdById: actorId,
      currency: payment.currency,
      exchangeRateToBDT: payment.exchangeRateToBDT,
      lines,
    });
  } catch (error) {
    console.error("Failed to post payment journal entry", error);
  }
}

export async function reversePaymentEntry(
  tx: Prisma.TransactionClient,
  params: { companyId: string; paymentId: string; direction: "RECEIVED" | "PAID" },
  actorId: string,
): Promise<void> {
  try {
    await reverseJournalEntry(tx, {
      companyId: params.companyId,
      sourceType: "PAYMENT",
      sourceId: params.paymentId,
      voucherType: params.direction === "RECEIVED" ? "RECEIPT" : "PAYMENT",
      createdById: actorId,
    });
  } catch (error) {
    console.error("Failed to reverse payment journal entry", error);
  }
}
