/**
 * Seeds realistic BDT accounting demo data into an existing company (by
 * default "FreightFast Demo Company") so its Trial Balance, Profit & Loss,
 * and Balance Sheet reports have real-looking numbers for a client demo:
 * ~10 customers, 5 vendors, 15 invoices, 8 vendor bills, their payments,
 * and 7 manual journal vouchers (capital, rent, salary, utilities, office
 * equipment) -- posted through the same accounting hooks the real app uses
 * (postInvoiceSentEntry / postVendorBillReceivedEntry / postPaymentEntry /
 * syncJournalEntry), so the resulting ledger is indistinguishable from data
 * entered by hand through the UI.
 *
 * Safe to re-run: setup steps (branch, roles, admin, chart of accounts,
 * exchange rate) only create what's missing. The demo transactions
 * themselves are skipped entirely if this company already has any invoice
 * -- re-running after a successful seed is a safe no-op, not a duplicate.
 *
 * Requires the company to already exist (created via Platform ->
 * Companies) -- this script does not create the company record itself.
 * Only tested against a BDT-base company; aborts before writing anything
 * if the target company's base currency is not BDT.
 *
 * Usage: point DATABASE_URL at the target database (local or live) and run
 *   npx tsx scripts/seed-freightfast-demo-accounting.ts "Exact Company Name"
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

const COMPANY_NAME = process.argv[2] ?? "FreightFast Demo Company";
const RATE_DATE = new Date("2025-01-01T00:00:00");
const BDT_TO_BDT = 1; // invoices are already in the company's own base currency

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
  if (!adminEmail) adminEmail = `admin+${randomUUID().slice(0, 8)}@placeholder.freito.local`;

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
    "Bengal Apparel Export Ltd.",
    "Chittagong Steel Industries Ltd.",
    "Padma Agro Foods Ltd.",
    "Dhaka Textile Mills Ltd.",
    "Meghna Plastics & Packaging Ltd.",
    "Jamuna Electronics Trading",
    "Karnaphuli Ceramics Ltd.",
    "Sylhet Tea Export Company",
    "Gazipur Garments & Knitwear Ltd.",
    "Sonar Bangla Trading House",
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
    { name: "Maersk Bangladesh Ltd.", type: "SHIPPING_LINE" },
    { name: "MSC Bangladesh Agencies", type: "SHIPPING_LINE" },
    { name: "Chittagong Customs Clearing Agency", type: "C_AND_F_AGENT" },
    { name: "Bengal Inland Transport Services", type: "TRUCK_VENDOR" },
    { name: "Chittagong Port Handling Services", type: "WAREHOUSE_CFS" },
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
        currency: "BDT",
        exchangeRateToBDT: BDT_TO_BDT,
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
          currency: "BDT",
          exchangeRateToBDT: BDT_TO_BDT,
          amount: new Prisma.Decimal(paidAmount),
          amountInBDT: new Prisma.Decimal(paidAmount),
          createdById: adminId,
          updatedAt: invoiceDate,
        },
      });
      await prisma.$transaction(async (tx) => {
        await postPaymentEntry(tx, payment, adminId);
      });
    }
    console.log(`  ${invoiceNo} -> ${customerName}: BDT ${unitPrice} (${invoice.status})`);
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
        currency: "BDT",
        exchangeRateToBDT: BDT_TO_BDT,
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
          currency: "BDT",
          exchangeRateToBDT: BDT_TO_BDT,
          amount: new Prisma.Decimal(paidAmount),
          amountInBDT: new Prisma.Decimal(paidAmount),
          createdById: adminId,
          updatedAt: billDate,
        },
      });
      await prisma.$transaction(async (tx) => {
        await postPaymentEntry(tx, payment, adminId);
      });
    }
    console.log(`  ${billNo} -> ${vendorName}: BDT ${unitPrice} (${bill.status})`);
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
        currency: "BDT",
        exchangeRateToBDT: BDT_TO_BDT,
        lines: [
          { ledgerAccountId: debitLedgerId, side: "DEBIT", amount },
          { ledgerAccountId: creditLedgerId, side: "CREDIT", amount },
        ],
      });
    });
    console.log(`  Voucher: ${narration} -> BDT ${amount}`);
  }

  console.log("Posting invoices...");
  await createInvoice("Bengal Apparel Export Ltd.", "2026-07-16", "Sea Freight - FCL 40ft Chittagong to Shanghai", 585000, 585000);
  await createInvoice("Chittagong Steel Industries Ltd.", "2026-07-20", "Sea Freight - Bulk Steel Coils", 1340000, 1340000);
  await createInvoice("Padma Agro Foods Ltd.", "2026-07-25", "Air Freight - Perishable Goods Dhaka to Dubai", 305000, 305000);
  await createInvoice("Dhaka Textile Mills Ltd.", "2026-07-29", "Customs Clearance + Documentation", 135000, 135000);
  await createInvoice("Meghna Plastics & Packaging Ltd.", "2026-08-02", "Sea Freight - FCL 20ft Chittagong to Mumbai", 500000, 500000);
  await createInvoice("Jamuna Electronics Trading", "2026-08-05", "Trucking - Chittagong Port to Dhaka Warehouse", 102000, 102000);
  await createInvoice("Karnaphuli Ceramics Ltd.", "2026-08-08", "Sea Freight - LCL Consolidation", 365000, 190000);
  await createInvoice("Sylhet Tea Export Company", "2026-08-12", "Air Freight - Cold Chain Cargo", 420000, 420000);
  await createInvoice("Gazipur Garments & Knitwear Ltd.", "2026-08-15", "Sea Freight - FCL 40ft Chittagong to Karachi", 670000, 320000);
  await createInvoice("Sonar Bangla Trading House", "2026-08-18", "Customs Clearance + Handling", 172000, 172000);
  await createInvoice("Bengal Apparel Export Ltd.", "2026-08-22", "Sea Freight - FCL 40ft Chittagong to Hamburg", 875000, 0);
  await createInvoice("Chittagong Steel Industries Ltd.", "2026-08-25", "Warehousing & Handling Charges", 218000, 0);
  await createInvoice("Padma Agro Foods Ltd.", "2026-08-29", "Sea Freight - Reefer Container", 780000, 0);
  await createInvoice("Meghna Plastics & Packaging Ltd.", "2026-09-02", "Air Freight - Electronics Consignment", 545000, 0);
  await createInvoice("Karnaphuli Ceramics Ltd.", "2026-09-06", "Documentation + Customs Fee", 121000, 0);

  console.log("Posting vendor bills...");
  await createVendorBill("Maersk Bangladesh Ltd.", "2026-07-17", "Ocean Freight Charges - FCL 40ft", 450000, 450000);
  await createVendorBill("MSC Bangladesh Agencies", "2026-07-22", "Ocean Freight Charges - Bulk Cargo", 985000, 985000);
  await createVendorBill("Chittagong Customs Clearing Agency", "2026-07-30", "Customs Duty & Clearance Fee", 98000, 98000);
  await createVendorBill("Bengal Inland Transport Services", "2026-08-03", "Trucking Charges - Inland Transport", 76000, 76000);
  await createVendorBill("Chittagong Port Handling Services", "2026-08-09", "Terminal Handling Charges", 165000, 95000);
  await createVendorBill("Maersk Bangladesh Ltd.", "2026-08-16", "Ocean Freight Charges - FCL 40ft", 495000, 255000);
  await createVendorBill("Chittagong Customs Clearing Agency", "2026-08-23", "Customs Duty & Clearance Fee", 124000, 0);
  await createVendorBill("MSC Bangladesh Agencies", "2026-08-30", "Ocean Freight Charges - Reefer", 598000, 0);

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

  await postVoucher("2026-07-15", "Owner's Capital contribution", bankLedgerId, capitalLedgerId, 5000000);
  await postVoucher("2026-07-31", "Office Rent - July", rentLedgerId, bankLedgerId, 180000);
  await postVoucher("2026-07-31", "Staff Salaries - July", salaryLedgerId, bankLedgerId, 650000);
  await postVoucher("2026-08-05", "Office Equipment Purchase", equipmentLedgerId, bankLedgerId, 320000);
  await postVoucher("2026-08-31", "Office Rent - August", rentLedgerId, bankLedgerId, 180000);
  await postVoucher("2026-08-31", "Staff Salaries - August", salaryLedgerId, bankLedgerId, 680000);
  await postVoucher("2026-08-31", "Utilities Bill - August", utilitiesLedgerId, bankLedgerId, 45000);
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
  const bdtRate = await getRateToUSD("BDT", new Date());
  console.log("BDT -> USD rate in effect:", bdtRate.toString());
}

async function main() {
  const company = await prisma.company.findFirst({ where: { name: COMPANY_NAME } });
  if (!company) {
    throw new Error(
      `Company "${COMPANY_NAME}" not found. Create it first via Platform -> Companies (this script does not create the company itself).`,
    );
  }
  console.log(`Found company: ${company.name} (${company.id}), base currency ${company.baseCurrency}`);
  if (company.baseCurrency !== "BDT") {
    throw new Error(
      `This company's base currency is ${company.baseCurrency}, not BDT. This script's demo data (invoices, bills, vouchers) is hard-coded in BDT -- posting BDT transactions into a non-BDT-base company would produce misleading reports. Aborting before writing anything.`,
    );
  }

  await upsertExchangeRate({ currency: "BDT", rateToUSD: 0.008368, effectiveDate: RATE_DATE });
  console.log("Ensured BDT exchange rate.");

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
