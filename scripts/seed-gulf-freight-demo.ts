/**
 * Seeds realistic demo data for the "Gulf Freight FZE" company: default
 * branch/roles/admin login if missing, chart of accounts, BDT/AED exchange
 * rates, then ~10 customers, ~5 vendors, 15 invoices, 8 vendor bills, their
 * payments, and 7 manual journal vouchers (capital, rent, salary, utilities,
 * office equipment) -- posted through the same accounting hooks the real
 * app uses (postInvoiceSentEntry / postVendorBillReceivedEntry /
 * postPaymentEntry / syncJournalEntry), so the resulting ledger is
 * indistinguishable from data entered by hand through the UI.
 *
 * Safe to re-run: every setup step (branch, roles, admin, chart of
 * accounts, exchange rates) only creates what's missing. The demo
 * transactions themselves are NOT re-created if this company already has
 * any invoices -- re-running after a successful seed is a safe no-op for
 * that part, not a duplicate.
 *
 * Requires the company to already exist (created via Platform -> Companies
 * first) -- this script deliberately does not create the company record
 * itself, since that's a platform-admin decision (plan, modules, portal
 * settings) made through the UI.
 *
 * Usage: point DATABASE_URL at the target database (local or live) and run
 *   npx tsx scripts/seed-gulf-freight-demo.ts
 *
 * Running this against a live/production database is a real write to real
 * data -- review the printed plan and the final summary, and only run it
 * against production once you've verified it against a local/staging copy.
 */
import "dotenv/config";
import { randomUUID } from "crypto";
import { prisma } from "../lib/db/prisma";
import { Prisma } from "../lib/generated/prisma/client";
import { hashPassword } from "../lib/auth/password";
import { generateClientPortalPassword } from "../lib/client-portal/credentials";
import {
  COMPANY_ROLE_CODES,
  COMPANY_ROLE_NAMES,
  COMPANY_ROLE_PERMISSIONS,
} from "../lib/permissions/company-role-permissions";
import {
  seedDefaultChartOfAccounts,
  ensureCustomerLedgerAccount,
  ensureVendorLedgerAccount,
  ensureNamedLedgerAccount,
  BANK_GROUP_NAME,
  BANK_LEDGER_NAME,
} from "../lib/accounting/seed-chart-of-accounts";
import { postInvoiceSentEntry, postVendorBillReceivedEntry, postPaymentEntry } from "../lib/accounting/billing-hooks";
import { syncJournalEntry } from "../lib/accounting/posting";
import { upsertExchangeRate, getRateToUSD } from "../lib/accounting/exchange-rates";

// Pass the exact company name as a command-line argument, e.g.:
//   npx tsx scripts/seed-gulf-freight-demo.ts "Gulf Freight FZE"
// Defaults to "Gulf Freight FZE" only for local convenience -- the live
// company is very likely named differently, so always pass it explicitly
// when running against a live/production database.
const COMPANY_NAME = process.argv[2] ?? "Gulf Freight FZE";
const RATE_DATE = new Date("2025-01-01T00:00:00");
const AED_TO_BDT = 32.55;

async function ensureBranchRolesAdmin(companyId: string, contactEmail: string | null) {
  const now = new Date();

  let branch = await prisma.branch.findFirst({ where: { companyId, code: "HEAD_OFFICE" } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { id: randomUUID(), companyId, code: "HEAD_OFFICE", name: "Head Office", isActive: true, updatedAt: now },
    });
    console.log("Created branch: Head Office");
  } else {
    console.log("Branch already exists: Head Office");
  }

  const existingRoleCount = await prisma.role.count({ where: { companyId } });
  const roleIdByCode = new Map<string, string>();
  if (existingRoleCount === 0) {
    const allPermissions = await prisma.permission.findMany({ select: { id: true, key: true } });
    const permissionIdByKey = new Map(allPermissions.map((p) => [p.key, p.id]));
    for (const code of COMPANY_ROLE_CODES) {
      const role = await prisma.role.create({
        data: { id: randomUUID(), companyId, code, name: COMPANY_ROLE_NAMES[code], isSystem: true, updatedAt: now },
      });
      roleIdByCode.set(code, role.id);
      const permissionIds = COMPANY_ROLE_PERMISSIONS[code]
        .map((key) => permissionIdByKey.get(key))
        .filter((id): id is string => Boolean(id));
      if (permissionIds.length) {
        await prisma.rolepermission.createMany({
          data: permissionIds.map((permissionId) => ({ id: randomUUID(), roleId: role.id, permissionId })),
        });
      }
    }
    console.log(`Created ${COMPANY_ROLE_CODES.length} default company roles.`);
  } else {
    console.log(`Roles already exist (${existingRoleCount} found), skipping role creation.`);
    const roles = await prisma.role.findMany({ where: { companyId }, select: { id: true, code: true } });
    for (const r of roles) roleIdByCode.set(r.code, r.id);
  }

  const existingAdmin = await prisma.user.findFirst({ where: { companyId, scope: "COMPANY" }, orderBy: { createdAt: "asc" } });
  if (existingAdmin) {
    console.log(`Admin user already exists: ${existingAdmin.email} (no new password generated).`);
    return { adminEmail: existingAdmin.email, adminPassword: null as string | null };
  }

  let adminEmail = (contactEmail ?? "").trim().toLowerCase();
  if (adminEmail) {
    const taken = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (taken) adminEmail = "";
  }
  if (!adminEmail) adminEmail = `admin+${randomUUID().slice(0, 8)}@placeholder.freightfast.local`;

  const adminPassword = generateClientPortalPassword();
  const passwordHash = await hashPassword(adminPassword);
  const adminUser = await prisma.user.create({
    data: { id: randomUUID(), companyId, name: "Company Admin", email: adminEmail, passwordHash, status: "ACTIVE", scope: "COMPANY", updatedAt: now },
  });
  const companyAdminRoleId = roleIdByCode.get("COMPANY_ADMIN");
  if (companyAdminRoleId) {
    await prisma.userrole.create({ data: { id: randomUUID(), userId: adminUser.id, roleId: companyAdminRoleId } });
  }
  await prisma.userbranchmembership.create({
    data: { id: randomUUID(), userId: adminUser.id, branchId: branch.id, isDefault: true, updatedAt: now },
  });
  console.log(`Created admin user: ${adminEmail}`);
  return { adminEmail, adminPassword };
}

async function seedDemoTransactions(companyId: string, branchId: string, adminId: string) {
  const existingInvoices = await prisma.invoice.count({ where: { companyId } });
  if (existingInvoices > 0) {
    console.log(`This company already has ${existingInvoices} invoice(s) -- skipping demo transaction seeding to avoid duplicates.`);
    return;
  }

  console.log("Creating customers...");
  const customerNames = [
    "Al Maha General Trading LLC",
    "Emirates Steel Building Materials Trading",
    "Gulf Horizon Foodstuff Trading LLC",
    "Barakah Textiles & Garments LLC",
    "Desert Rose Electronics Trading",
    "Falcon Auto Parts Trading LLC",
    "Noor Al Sabah Furniture Trading",
    "Al Ain Dairy Products Distribution",
    "Sharjah Plastic Industries LLC",
    "Silk Route Import Export LLC",
  ];
  const customers: Record<string, { id: string; name: string }> = {};
  for (const name of customerNames) {
    const customer = await prisma.customer.create({
      data: { id: randomUUID(), companyId, name, status: "ACTIVE", updatedAt: new Date() },
    });
    await ensureCustomerLedgerAccount(companyId, customer.id, customer.name);
    customers[name] = customer;
  }

  console.log("Creating vendors...");
  const vendorDefs: { name: string; type: string }[] = [
    { name: "Maersk Middle East FZE", type: "SHIPPING_LINE" },
    { name: "MSC Gulf Agencies LLC", type: "SHIPPING_LINE" },
    { name: "Al Rashid Customs Clearance LLC", type: "C_AND_F_AGENT" },
    { name: "Transguard Logistics Services", type: "TRUCK_VENDOR" },
    { name: "Jebel Ali Port Handling Services", type: "WAREHOUSE_CFS" },
  ];
  const vendors: Record<string, { id: string; name: string }> = {};
  for (const v of vendorDefs) {
    const vendor = await prisma.vendor.create({
      data: { id: randomUUID(), companyId, name: v.name, type: v.type as never, status: "ACTIVE", updatedAt: new Date() },
    });
    await ensureVendorLedgerAccount(companyId, vendor.id, vendor.name);
    vendors[v.name] = vendor;
  }

  let invoiceSeq = 0;
  async function createInvoice(customerName: string, dateStr: string, description: string, unitPrice: number, paidAmount: number) {
    invoiceSeq += 1;
    const invoiceNo = `INV-2026-${String(invoiceSeq).padStart(4, "0")}`;
    const invoiceDate = new Date(`${dateStr}T00:00:00`);
    const customer = customers[customerName];
    const totalAmount = new Prisma.Decimal(unitPrice);
    const invoice = await prisma.invoice.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId,
        invoiceNo,
        customerId: customer.id,
        status: paidAmount >= unitPrice ? "PAID" : paidAmount > 0 ? "PARTIALLY_PAID" : "SENT",
        invoiceDate,
        dueDate: new Date(invoiceDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        currency: "AED",
        exchangeRateToBDT: AED_TO_BDT,
        subtotal: totalAmount,
        totalAmount,
        paidAmount: new Prisma.Decimal(paidAmount),
        dueAmount: totalAmount.sub(paidAmount),
        createdById: adminId,
        sentAt: invoiceDate,
        updatedAt: invoiceDate,
      },
    });
    await prisma.invoiceline.create({
      data: {
        id: randomUUID(),
        companyId,
        invoiceId: invoice.id,
        description,
        quantity: new Prisma.Decimal(1),
        unitPrice: totalAmount,
        amount: totalAmount,
        updatedAt: invoiceDate,
      },
    });
    await prisma.$transaction(async (tx) => {
      await postInvoiceSentEntry(tx, invoice, adminId);
    });
    if (paidAmount > 0) {
      const payment = await prisma.payment.create({
        data: {
          id: randomUUID(),
          companyId,
          branchId,
          paymentNo: `PAY-2026-${String(invoiceSeq).padStart(4, "0")}C`,
          direction: "RECEIVED",
          status: "CLEARED",
          customerId: customer.id,
          invoiceId: invoice.id,
          paymentDate: new Date(invoiceDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          paymentMethod: "BANK_TRANSFER",
          currency: "AED",
          exchangeRateToBDT: AED_TO_BDT,
          amount: new Prisma.Decimal(paidAmount),
          amountInBDT: new Prisma.Decimal(paidAmount).mul(AED_TO_BDT),
          createdById: adminId,
          updatedAt: invoiceDate,
        },
      });
      await prisma.$transaction(async (tx) => {
        await postPaymentEntry(tx, payment, adminId);
      });
    }
    console.log(`  ${invoiceNo} -> ${customerName}: AED ${unitPrice} (${invoice.status})`);
  }

  let billSeq = 0;
  async function createVendorBill(vendorName: string, dateStr: string, description: string, unitPrice: number, paidAmount: number) {
    billSeq += 1;
    const billNo = `VB-2026-${String(billSeq).padStart(4, "0")}`;
    const billDate = new Date(`${dateStr}T00:00:00`);
    const vendor = vendors[vendorName];
    const totalAmount = new Prisma.Decimal(unitPrice);
    const bill = await prisma.vendorbill.create({
      data: {
        id: randomUUID(),
        companyId,
        branchId,
        billNo,
        vendorId: vendor.id,
        status: paidAmount >= unitPrice ? "PAID" : paidAmount > 0 ? "PARTIALLY_PAID" : "RECEIVED",
        billDate,
        dueDate: new Date(billDate.getTime() + 15 * 24 * 60 * 60 * 1000),
        currency: "AED",
        exchangeRateToBDT: AED_TO_BDT,
        subtotal: totalAmount,
        totalAmount,
        paidAmount: new Prisma.Decimal(paidAmount),
        dueAmount: totalAmount.sub(paidAmount),
        createdById: adminId,
        receivedAt: billDate,
        updatedAt: billDate,
      },
    });
    await prisma.vendorbillline.create({
      data: {
        id: randomUUID(),
        companyId,
        vendorBillId: bill.id,
        description,
        quantity: new Prisma.Decimal(1),
        unitPrice: totalAmount,
        amount: totalAmount,
        updatedAt: billDate,
      },
    });
    await prisma.$transaction(async (tx) => {
      await postVendorBillReceivedEntry(tx, bill, adminId);
    });
    if (paidAmount > 0) {
      const payment = await prisma.payment.create({
        data: {
          id: randomUUID(),
          companyId,
          branchId,
          paymentNo: `PAY-2026-${String(billSeq).padStart(4, "0")}V`,
          direction: "PAID",
          status: "CLEARED",
          vendorId: vendor.id,
          vendorBillId: bill.id,
          paymentDate: new Date(billDate.getTime() + 3 * 24 * 60 * 60 * 1000),
          paymentMethod: "BANK_TRANSFER",
          currency: "AED",
          exchangeRateToBDT: AED_TO_BDT,
          amount: new Prisma.Decimal(paidAmount),
          amountInBDT: new Prisma.Decimal(paidAmount).mul(AED_TO_BDT),
          createdById: adminId,
          updatedAt: billDate,
        },
      });
      await prisma.$transaction(async (tx) => {
        await postPaymentEntry(tx, payment, adminId);
      });
    }
    console.log(`  ${billNo} -> ${vendorName}: AED ${unitPrice} (${bill.status})`);
  }

  async function postVoucher(dateStr: string, narration: string, debitLedgerId: string, creditLedgerId: string, amount: number) {
    const entryDate = new Date(`${dateStr}T00:00:00`);
    await prisma.$transaction(async (tx) => {
      await syncJournalEntry(tx, {
        companyId,
        entryDate,
        voucherType: "JOURNAL",
        narration,
        sourceType: "MANUAL_VOUCHER",
        sourceId: randomUUID(),
        createdById: adminId,
        currency: "AED",
        exchangeRateToBDT: AED_TO_BDT,
        lines: [
          { ledgerAccountId: debitLedgerId, side: "DEBIT", amount },
          { ledgerAccountId: creditLedgerId, side: "CREDIT", amount },
        ],
      });
    });
    console.log(`  Voucher: ${narration} -> AED ${amount}`);
  }

  console.log("Posting invoices...");
  await createInvoice("Al Maha General Trading LLC", "2026-07-16", "Sea Freight - FCL 40ft Jebel Ali to Shanghai", 18500, 18500);
  await createInvoice("Emirates Steel Building Materials Trading", "2026-07-20", "Sea Freight - Bulk Steel Coils", 42000, 42000);
  await createInvoice("Gulf Horizon Foodstuff Trading LLC", "2026-07-25", "Air Freight - Perishable Goods Dubai to Riyadh", 9600, 9600);
  await createInvoice("Barakah Textiles & Garments LLC", "2026-07-29", "Customs Clearance + Documentation", 4200, 4200);
  await createInvoice("Desert Rose Electronics Trading", "2026-08-02", "Sea Freight - FCL 20ft Jebel Ali to Mumbai", 15800, 15800);
  await createInvoice("Falcon Auto Parts Trading LLC", "2026-08-05", "Trucking - Jebel Ali to Abu Dhabi Warehouse", 3200, 3200);
  await createInvoice("Noor Al Sabah Furniture Trading", "2026-08-08", "Sea Freight - LCL Consolidation", 11500, 6000);
  await createInvoice("Al Ain Dairy Products Distribution", "2026-08-12", "Air Freight - Cold Chain Cargo", 13200, 13200);
  await createInvoice("Sharjah Plastic Industries LLC", "2026-08-15", "Sea Freight - FCL 40ft Jebel Ali to Karachi", 21000, 10000);
  await createInvoice("Silk Route Import Export LLC", "2026-08-18", "Customs Clearance + Handling", 5400, 5400);
  await createInvoice("Al Maha General Trading LLC", "2026-08-22", "Sea Freight - FCL 40ft Jebel Ali to Hamburg", 27500, 0);
  await createInvoice("Emirates Steel Building Materials Trading", "2026-08-25", "Warehousing & Handling Charges", 6800, 0);
  await createInvoice("Gulf Horizon Foodstuff Trading LLC", "2026-08-29", "Sea Freight - Reefer Container", 24500, 0);
  await createInvoice("Desert Rose Electronics Trading", "2026-09-02", "Air Freight - Electronics Consignment", 17200, 0);
  await createInvoice("Noor Al Sabah Furniture Trading", "2026-09-06", "Documentation + Customs Fee", 3800, 0);

  console.log("Posting vendor bills...");
  await createVendorBill("Maersk Middle East FZE", "2026-07-17", "Ocean Freight Charges - FCL 40ft", 14200, 14200);
  await createVendorBill("MSC Gulf Agencies LLC", "2026-07-22", "Ocean Freight Charges - Bulk Cargo", 31000, 31000);
  await createVendorBill("Al Rashid Customs Clearance LLC", "2026-07-30", "Customs Duty & Clearance Fee", 3100, 3100);
  await createVendorBill("Transguard Logistics Services", "2026-08-03", "Trucking Charges - Inland Transport", 2400, 2400);
  await createVendorBill("Jebel Ali Port Handling Services", "2026-08-09", "Terminal Handling Charges", 5200, 3000);
  await createVendorBill("Maersk Middle East FZE", "2026-08-16", "Ocean Freight Charges - FCL 40ft", 15600, 8000);
  await createVendorBill("Al Rashid Customs Clearance LLC", "2026-08-23", "Customs Duty & Clearance Fee", 3900, 0);
  await createVendorBill("MSC Gulf Agencies LLC", "2026-08-30", "Ocean Freight Charges - Reefer", 18800, 0);

  console.log("Posting journal vouchers...");
  const bankLedgerId = await ensureNamedLedgerAccount(companyId, BANK_GROUP_NAME, BANK_LEDGER_NAME);
  const capitalLedgerId = await ensureNamedLedgerAccount(companyId, "Capital Account", "Owner's Capital");
  const rentLedgerId = await ensureNamedLedgerAccount(companyId, "Indirect Expenses", "Rent Expense");
  const salaryLedgerId = await ensureNamedLedgerAccount(companyId, "Indirect Expenses", "Salary Expense");
  const utilitiesLedgerId = await ensureNamedLedgerAccount(companyId, "Indirect Expenses", "Utilities Expense");
  const equipmentLedgerId = await ensureNamedLedgerAccount(companyId, "Fixed Assets", "Office Equipment");
  if (!bankLedgerId || !capitalLedgerId || !rentLedgerId || !salaryLedgerId || !utilitiesLedgerId || !equipmentLedgerId) {
    throw new Error("Failed to ensure one or more ledger accounts for journal vouchers");
  }

  await postVoucher("2026-07-15", "Owner's Capital contribution", bankLedgerId, capitalLedgerId, 200000);
  await postVoucher("2026-07-31", "Office Rent - July", rentLedgerId, bankLedgerId, 8000);
  await postVoucher("2026-07-31", "Staff Salaries - July", salaryLedgerId, bankLedgerId, 22000);
  await postVoucher("2026-08-05", "Office Equipment Purchase", equipmentLedgerId, bankLedgerId, 15000);
  await postVoucher("2026-08-31", "Office Rent - August", rentLedgerId, bankLedgerId, 8000);
  await postVoucher("2026-08-31", "Staff Salaries - August", salaryLedgerId, bankLedgerId, 23500);
  await postVoucher("2026-08-31", "Utilities - DEWA Bill", utilitiesLedgerId, bankLedgerId, 1450);
}

async function printVerification(companyId: string) {
  const lines = await prisma.journalentryline.findMany({ where: { journalentry: { companyId } } });
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    if (l.side === "DEBIT") debit += Number(l.nativeAmount);
    else credit += Number(l.nativeAmount);
  }
  console.log("\n--- Verification ---");
  console.log("Total journal lines:", lines.length);
  console.log("Total debit:", debit.toFixed(2), "Total credit:", credit.toFixed(2), "balanced:", Math.abs(debit - credit) < 0.01);
  const aedRate = await getRateToUSD("AED", new Date());
  console.log("AED -> USD rate in effect:", aedRate.toString());
}

async function main() {
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) {
    throw new Error(
      `Company "${COMPANY_NAME}" not found. Create it first via Platform -> Companies (this script does not create the company itself).`,
    );
  }
  console.log(`Found company: ${company.name} (${company.id}), base currency ${company.baseCurrency}`);
  if (company.baseCurrency !== "AED") {
    throw new Error(
      `This company's base currency is ${company.baseCurrency}, not AED. This script's demo data (invoices, bills, vouchers) is hard-coded in AED -- posting AED transactions into a non-AED-base company would produce misleading reports. Aborting before writing anything.`,
    );
  }

  await upsertExchangeRate({ currency: "BDT", rateToUSD: 0.008368, effectiveDate: RATE_DATE });
  await upsertExchangeRate({ currency: "AED", rateToUSD: 0.2723, effectiveDate: RATE_DATE });
  console.log("Ensured BDT and AED exchange rates.");

  await seedDefaultChartOfAccounts(company.id);
  console.log("Ensured chart of accounts.");

  const { adminEmail, adminPassword } = await ensureBranchRolesAdmin(company.id, company.email);

  const branch = await prisma.branch.findFirstOrThrow({ where: { companyId: company.id, code: "HEAD_OFFICE" } });
  const adminUser = await prisma.user.findFirstOrThrow({ where: { companyId: company.id, scope: "COMPANY" }, orderBy: { createdAt: "asc" } });

  await seedDemoTransactions(company.id, branch.id, adminUser.id);
  await printVerification(company.id);

  console.log("\n=== Done ===");
  console.log("Admin login email:", adminEmail);
  if (adminPassword) {
    console.log("Admin temporary password (shown once):", adminPassword);
  } else {
    console.log("Admin password unchanged (an admin user already existed).");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
