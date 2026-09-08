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

const DEMO_COMPANY_SLUG = process.env.DEMO_COMPANY_SLUG ?? "demo-freight";
const DEMO_CLIENT_ID = process.env.DEMO_CLIENT_ID ?? "DFC-CL-2026-0001";

type DeleteSummary = Record<string, number>;

async function main() {
  const company = await prisma.company.findFirst({
    where: { portalSlug: DEMO_COMPANY_SLUG },
    select: { id: true, name: true, portalSlug: true },
  });

  if (!company) {
    throw new Error(`Demo company with portal slug "${DEMO_COMPANY_SLUG}" was not found.`);
  }

  const [platformUser, companyAdmin, portalAccount] = await Promise.all([
    prisma.user.findUnique({
      where: { email: "platform@freightcontrol.com" },
      select: { id: true, email: true, scope: true, status: true },
    }),
    prisma.user.findUnique({
      where: { email: "admin@freightcontrol.com" },
      select: { id: true, email: true, companyId: true, scope: true, status: true },
    }),
    prisma.clientPortalAccount.findFirst({
      where: {
        companyId: company.id,
        displayClientCode: DEMO_CLIENT_ID,
      },
      select: {
        id: true,
        displayClientCode: true,
        status: true,
        customer: { select: { id: true, name: true, code: true, status: true } },
      },
    }),
  ]);

  if (!platformUser) {
    throw new Error("Required platform login platform@freightcontrol.com was not found.");
  }
  if (!companyAdmin || companyAdmin.companyId !== company.id) {
    throw new Error("Required company admin login admin@freightcontrol.com was not found for the demo company.");
  }
  if (!portalAccount) {
    throw new Error(`Required client portal account ${DEMO_CLIENT_ID} was not found.`);
  }

  const summary: DeleteSummary = {};

  await prisma.$transaction(
    async (tx) => {
      async function record(label: string, operation: Promise<{ count: number }>) {
        const result = await operation;
        summary[label] = result.count;
      }

      await record("Task comments", tx.taskComment.deleteMany({ where: { companyId: company.id } }));
      await record("Tasks", tx.task.deleteMany({ where: { companyId: company.id } }));

      await record("Notification deliveries", tx.notificationDelivery.deleteMany({ where: { companyId: company.id } }));
      await record("Notifications", tx.notification.deleteMany({ where: { companyId: company.id } }));
      await record("Portal activation tokens", tx.customerPortalActivationToken.deleteMany({ where: { companyId: company.id } }));

      await record(
        "Freight document approvals",
        tx.documentApproval.deleteMany({ where: { freightDocument: { companyId: company.id } } }),
      );
      await record(
        "Freight document versions",
        tx.documentVersion.deleteMany({ where: { freightDocument: { companyId: company.id } } }),
      );
      await record("Freight documents", tx.freightDocument.deleteMany({ where: { companyId: company.id } }));
      await record("Shipment documents", tx.shipmentDocument.deleteMany({ where: { companyId: company.id } }));

      await record(
        "Workflow stage requirements",
        tx.workflowStageRequirement.deleteMany({
          where: {
            shipmentWorkflowStage: {
              shipmentWorkflow: {
                shipmentJob: { companyId: company.id },
              },
            },
          },
        }),
      );
      await record(
        "Workflow transitions",
        tx.workflowStageTransition.deleteMany({
          where: { shipmentWorkflow: { shipmentJob: { companyId: company.id } } },
        }),
      );
      await record(
        "Workflow audits",
        tx.workflowStageAudit.deleteMany({
          where: { shipmentWorkflow: { shipmentJob: { companyId: company.id } } },
        }),
      );
      await record(
        "Workflow overrides",
        tx.workflowOverride.deleteMany({
          where: { shipmentWorkflow: { shipmentJob: { companyId: company.id } } },
        }),
      );
      await record(
        "Workflow stages",
        tx.shipmentWorkflowStage.deleteMany({
          where: { shipmentWorkflow: { shipmentJob: { companyId: company.id } } },
        }),
      );
      await record(
        "Shipment workflows",
        tx.shipmentWorkflow.deleteMany({ where: { shipmentJob: { companyId: company.id } } }),
      );
      await record("Legacy workflow steps", tx.shipmentWorkflowStep.deleteMany({ where: { companyId: company.id } }));

      await record("Cargo release/POD records", tx.cargoReleaseChecklist.deleteMany({ where: { companyId: company.id } }));
      await record("Pre-alert records", tx.preAlert.deleteMany({ where: { companyId: company.id } }));
      await record("Bills of lading", tx.billOfLading.deleteMany({ where: { companyId: company.id } }));
      await record("Shipping instructions", tx.shippingInstruction.deleteMany({ where: { companyId: company.id } }));
      await record("Stuffing plans", tx.stuffingPlan.deleteMany({ where: { companyId: company.id } }));
      await record("Freight bookings", tx.freightBooking.deleteMany({ where: { companyId: company.id } }));

      await record("Carrier proposals", tx.carrierProposal.deleteMany({ where: { companyId: company.id } }));
      await record("Carrier queries", tx.carrierQuery.deleteMany({ where: { companyId: company.id } }));

      await record("Payments", tx.payment.deleteMany({ where: { companyId: company.id } }));
      await record("Invoice lines", tx.invoiceLine.deleteMany({ where: { companyId: company.id } }));
      await record("Vendor bill lines", tx.vendorBillLine.deleteMany({ where: { companyId: company.id } }));
      await record("Invoices", tx.invoice.deleteMany({ where: { companyId: company.id } }));
      await record("Vendor bills", tx.vendorBill.deleteMany({ where: { companyId: company.id } }));
      await record("Shipment costing items", tx.shipmentCostItem.deleteMany({ where: { companyId: company.id } }));
      await record("Quotation charges", tx.quotationCharge.deleteMany({ where: { companyId: company.id } }));
      await record("Quotations", tx.quotation.deleteMany({ where: { companyId: company.id } }));

      await record("Containers", tx.container.deleteMany({ where: { companyId: company.id } }));
      await record("Shipment status events", tx.shipmentStatusEvent.deleteMany({ where: { companyId: company.id } }));
      await record("Shipment jobs", tx.shipmentJob.deleteMany({ where: { companyId: company.id } }));
      await record("Shipment requests", tx.shipmentRequest.deleteMany({ where: { companyId: company.id } }));

      await record("Shipment job sequences", tx.shipmentJobSequence.deleteMany({ where: { companyId: company.id } }));
      await record("Quotation sequences", tx.quotationSequence.deleteMany({ where: { companyId: company.id } }));
      await record("Shipment request sequences", tx.shipmentRequestSequence.deleteMany({ where: { companyId: company.id } }));
      await record("Invoice sequences", tx.invoiceSequence.deleteMany({ where: { companyId: company.id } }));
      await record("Vendor bill sequences", tx.vendorBillSequence.deleteMany({ where: { companyId: company.id } }));
      await record("Payment sequences", tx.paymentSequence.deleteMany({ where: { companyId: company.id } }));
      await record("Freight document sequences", tx.freightDocumentSequence.deleteMany({ where: { companyId: company.id } }));
    },
    { timeout: 60000 },
  );

  summary["Company audit logs"] = 0;

  const preserved = await prisma.company.findUnique({
    where: { id: company.id },
    select: {
      id: true,
      name: true,
      portalSlug: true,
      users: {
        where: {
          email: { in: ["admin@freightcontrol.com"] },
        },
        select: { email: true, scope: true, status: true },
      },
      roles: { select: { code: true } },
      moduleAccess: { select: { moduleKey: true, isEnabled: true } },
      clientPortalAccounts: {
        where: { displayClientCode: DEMO_CLIENT_ID },
        select: {
          displayClientCode: true,
          status: true,
          customer: { select: { name: true, code: true, status: true } },
        },
      },
    },
  });

  console.log("Phase 18A-0 demo transactional cleanup completed.");
  console.log(`Company scoped: ${company.name} (${company.portalSlug})`);
  console.log("Deleted counts:");
  for (const [label, count] of Object.entries(summary)) {
    console.log(`- ${label}: ${count}`);
  }
  console.log("Preserved accounts/access:");
  console.log(`- Platform login: ${platformUser.email} (${platformUser.scope}, ${platformUser.status})`);
  console.log(`- Company admin: ${companyAdmin.email} (${companyAdmin.scope}, ${companyAdmin.status})`);
  console.log(`- Client portal ID: ${portalAccount.displayClientCode} (${portalAccount.status})`);
  console.log(`- Portal linked customer: ${portalAccount.customer.name} (${portalAccount.customer.code ?? "no code"})`);
  console.log(`- Demo company: ${preserved?.name} (${preserved?.portalSlug})`);
  console.log(`- Roles preserved: ${preserved?.roles.length ?? 0}`);
  console.log(`- Modules preserved: ${preserved?.moduleAccess.length ?? 0}`);
}

main()
  .catch((error) => {
    console.error("Phase 18A-0 cleanup failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
