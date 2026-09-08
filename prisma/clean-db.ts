import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../lib/generated/prisma/client";

function createAdapter() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  const url = new URL(databaseUrl);
  const isAzure = url.hostname.endsWith(".mysql.database.azure.com");
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: isAzure
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });
}

const prisma = new PrismaClient({ adapter: createAdapter() });

async function main() {
  console.log("Starting database cleanup...");
  
  // 1. Get all customer IDs that are referenced by ClientPortalAccount
  const portalAccounts = await prisma.clientportalaccount.findMany({
    select: { customerId: true }
  });
  const activeCustomerIds = portalAccounts.map(a => a.customerId).filter(Boolean) as string[];
  console.log(`Preserving ${activeCustomerIds.length} customer(s) linked to Client Portal Accounts.`);

  const tablesToClear = [
    "shipmentdocument",
    "shipmentstatusevent",
    "container",
    "shipmentworkflowstep",
    "quotationcharge",
    "shipmentcostitem",
    "taskcomment",
    "task",
    "carrierproposal",
    "carrierquery",
    "freightbooking",
    "stuffingplan",
    "shippinginstruction",
    "billoflading",
    "prealert",
    "cargoreleasechecklist",
    "auditlog",
    "notificationdelivery",
    "notification",
    "invoiceline",
    "invoice",
    "vendorbillline",
    "vendorbill",
    "payment",
    "shipmentjob",
    "quotation",
    "shipmentrequest",
    "vendorcontact",
    "vendor",
    "customercontact",
    "customerportalactivationtoken",
    "clientportalsequence",
    "passwordresettoken",
    "shipmentjobsequence",
    "quotationsequence",
    "shipmentrequestsequence",
    "invoicesequence",
    "vendorbillsequence",
    "paymentsequence"
  ];

  // 2. Execute everything inside a transaction to ensure FOREIGN_KEY_CHECKS=0 is session-bound
  await prisma.$transaction(async (tx) => {
    console.log("Disabling foreign key checks...");
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");
    
    for (const table of tablesToClear) {
      console.log(`Clearing table: ${table}`);
      await tx.$executeRawUnsafe(`DELETE FROM \`${table}\`;`);
    }

    // 3. Clear customers not linked to client portal accounts
    console.log("Clearing unlinked customers...");
    if (activeCustomerIds.length > 0) {
      const idsString = activeCustomerIds.map(id => `'${id}'`).join(",");
      await tx.$executeRawUnsafe(`DELETE FROM \`customer\` WHERE \`id\` NOT IN (${idsString});`);
    } else {
      await tx.$executeRawUnsafe("DELETE FROM `customer`;");
    }

    console.log("Re-enabling foreign key checks...");
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
  }, {
    timeout: 30000 // 30 seconds timeout
  });
  
  console.log("Database cleanup completed successfully.");
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
