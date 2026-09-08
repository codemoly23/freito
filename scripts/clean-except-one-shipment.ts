import "dotenv/config";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../lib/generated/prisma/client";

function createAdapter() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }
  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  });
}

const prisma = new PrismaClient({ adapter: createAdapter() });

async function main() {
  const targetJobNo = "SEA-IMP-2026-0145";
  console.log(`Locating target shipment job: ${targetJobNo}...`);

  const job = await prisma.shipmentJob.findFirst({
    where: { jobNo: targetJobNo },
    include: {
      quotations: true,
      convertedQuotations: true,
      invoices: true,
      vendorBills: true,
      tasks: true,
      carrierQueries: true,
      freightBooking: true,
      stuffingPlan: true,
      shippingInstruction: true,
      billOfLading: true,
      preAlert: true,
      cargoReleaseChecklist: true,
      convertedShipmentRequest: true,
    }
  });

  if (!job) {
    console.error(`Error: Shipment job "${targetJobNo}" was not found in the database.`);
    console.error("Please seed the database first before running this script.");
    process.exit(1);
  }

  console.log(`Found job: ID = ${job.id}, CustomerID = ${job.customerId}, CompanyID = ${job.companyId}`);

  // Collect IDs to preserve
  const jobId = job.id;
  const customerId = job.customerId;
  const companyId = job.companyId;

  const quotationIds = [
    ...job.quotations.map(q => q.id),
    ...job.convertedQuotations.map(q => q.id)
  ].filter(Boolean);

  const invoiceIds = job.invoices.map(i => i.id).filter(Boolean);
  const vendorBillIds = job.vendorBills.map(v => v.id).filter(Boolean);
  const taskIds = job.tasks.map(t => t.id).filter(Boolean);
  const carrierQueryIds = job.carrierQueries.map(c => c.id).filter(Boolean);
  const shipmentRequestId = job.convertedShipmentRequest?.id;

  // Helper for SQL IN clause formatting
  const sqlIn = (ids: string[]) => {
    if (ids.length === 0) return "('__NONE__')";
    return "(" + ids.map(id => `'${id}'`).join(",") + ")";
  };

  console.log("Starting transaction to delete other shipment records...");

  await prisma.$transaction(async (tx) => {
    console.log("Disabling foreign key checks...");
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0;");

    // Delete related entities not linked to the target job
    console.log("Deleting task comments...");
    await tx.$executeRawUnsafe(`DELETE FROM \`TaskComment\` WHERE \`taskId\` NOT IN ${sqlIn(taskIds)} OR \`taskId\` IS NULL;`);

    console.log("Deleting tasks...");
    await tx.$executeRawUnsafe(`DELETE FROM \`Task\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting containers...");
    await tx.$executeRawUnsafe(`DELETE FROM \`Container\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting status events...");
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentStatusEvent\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting documents...");
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentDocument\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`FreightDocument\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting workflow transitions, stage audits, overrides, and stages...");
    await tx.$executeRawUnsafe(`DELETE FROM \`WorkflowStageTransition\` WHERE \`shipmentWorkflowId\` NOT IN (SELECT \`id\` FROM \`ShipmentWorkflow\` WHERE \`shipmentJobId\` = '${jobId}');`);
    await tx.$executeRawUnsafe(`DELETE FROM \`WorkflowStageAudit\` WHERE \`shipmentWorkflowId\` NOT IN (SELECT \`id\` FROM \`ShipmentWorkflow\` WHERE \`shipmentJobId\` = '${jobId}');`);
    await tx.$executeRawUnsafe(`DELETE FROM \`WorkflowOverride\` WHERE \`shipmentWorkflowId\` NOT IN (SELECT \`id\` FROM \`ShipmentWorkflow\` WHERE \`shipmentJobId\` = '${jobId}');`);
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentWorkflowStage\` WHERE \`shipmentWorkflowId\` NOT IN (SELECT \`id\` FROM \`ShipmentWorkflow\` WHERE \`shipmentJobId\` = '${jobId}');`);
    
    console.log("Deleting shipment workflows...");
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentWorkflow\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentWorkflowStep\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting invoice lines...");
    await tx.$executeRawUnsafe(`DELETE FROM \`InvoiceLine\` WHERE \`invoiceId\` NOT IN ${sqlIn(invoiceIds)} OR \`invoiceId\` IS NULL;`);

    console.log("Deleting invoices...");
    await tx.$executeRawUnsafe(`DELETE FROM \`Invoice\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting vendor bill lines...");
    await tx.$executeRawUnsafe(`DELETE FROM \`VendorBillLine\` WHERE \`vendorBillId\` NOT IN ${sqlIn(vendorBillIds)} OR \`vendorBillId\` IS NULL;`);

    console.log("Deleting vendor bills...");
    await tx.$executeRawUnsafe(`DELETE FROM \`VendorBill\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting cost items...");
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentCostItem\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting quotation charges...");
    await tx.$executeRawUnsafe(`DELETE FROM \`QuotationCharge\` WHERE \`quotationId\` NOT IN ${sqlIn(quotationIds)} OR \`quotationId\` IS NULL;`);

    console.log("Deleting quotations...");
    await tx.$executeRawUnsafe(`DELETE FROM \`Quotation\` WHERE \`id\` NOT IN ${sqlIn(quotationIds)};`);

    console.log("Deleting carrier proposals and queries...");
    await tx.$executeRawUnsafe(`DELETE FROM \`CarrierProposal\` WHERE \`carrierQueryId\` NOT IN ${sqlIn(carrierQueryIds)} OR \`carrierQueryId\` IS NULL;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`CarrierQuery\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting bookings, stuffing plans, shipping instructions, and pre-alerts...");
    await tx.$executeRawUnsafe(`DELETE FROM \`FreightBooking\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`StuffingPlan\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`ShippingInstruction\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`BillOfLading\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`PreAlert\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`CargoReleaseChecklist\` WHERE \`shipmentJobId\` != '${jobId}' OR \`shipmentJobId\` IS NULL;`);

    console.log("Deleting shipment requests...");
    if (shipmentRequestId) {
      await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentRequest\` WHERE \`id\` != '${shipmentRequestId}';`);
    } else {
      await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentRequest\`;`);
    }

    console.log("Deleting other shipment jobs...");
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentJob\` WHERE \`id\` != '${jobId}';`);

    console.log("Deleting unlinked vendors and customer contacts...");
    await tx.$executeRawUnsafe(`DELETE FROM \`VendorContact\` WHERE \`vendorId\` NOT IN (SELECT \`vendorId\` FROM \`ShipmentCostItem\` WHERE \`shipmentJobId\` = '${jobId}') AND \`vendorId\` NOT IN (SELECT \`vendorId\` FROM \`VendorBill\` WHERE \`shipmentJobId\` = '${jobId}');`);
    await tx.$executeRawUnsafe(`DELETE FROM \`Vendor\` WHERE \`id\` NOT IN (SELECT \`vendorId\` FROM \`ShipmentCostItem\` WHERE \`shipmentJobId\` = '${jobId}') AND \`id\` NOT IN (SELECT \`vendorId\` FROM \`VendorBill\` WHERE \`shipmentJobId\` = '${jobId}');`);

    console.log("Deleting unlinked customer contacts, accounts, and customer...");
    await tx.$executeRawUnsafe(`DELETE FROM \`CustomerContact\` WHERE \`customerId\` != '${customerId}';`);
    await tx.$executeRawUnsafe(`DELETE FROM \`ClientPortalAccount\` WHERE \`customerId\` != '${customerId}';`);
    await tx.$executeRawUnsafe(`DELETE FROM \`Customer\` WHERE \`id\` != '${customerId}';`);

    console.log("Deleting audit logs, tokens, and sequences...");
    await tx.$executeRawUnsafe(`DELETE FROM \`AuditLog\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`NotificationDelivery\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`Notification\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`CustomerPortalActivationToken\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`PasswordResetToken\`;`);
    
    // Reset sequences/sequences numbers
    console.log("Resetting job sequences...");
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentJobSequence\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`QuotationSequence\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`ShipmentRequestSequence\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`InvoiceSequence\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`VendorBillSequence\`;`);
    await tx.$executeRawUnsafe(`DELETE FROM \`PaymentSequence\`;`);

    console.log("Re-enabling foreign key checks...");
    await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1;");
  }, {
    timeout: 30000 // 30 seconds
  });

  console.log(`\nSuccess! All transaction data deleted except shipment ${targetJobNo} and its related records.`);
}

main()
  .catch((e) => {
    console.error("Cleanup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
