import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import {
  quotationcharge_chargeBasis as ChargeBasis,
  quotationcharge_chargeType as ChargeType,
  invoice_currency as CurrencyCode,
  shipmentdocument_status as DocumentStatus,
  freightdocument_handlingMode as FreightDocumentHandlingMode,
  freightdocument_responsibility as FreightDocumentResponsibility,
  freightdocument_status as FreightDocumentStatus,
  freightdocument_type as FreightDocumentType,
  freightdocument_visibility as FreightDocumentVisibility,
  invoice_status as InvoiceStatus,
  shipmentjob_loadType as LoadType,
  customer_status as PartyStatus,
  payment_direction as PaymentDirection,
  payment_paymentMethod as PaymentMethod,
  payment_status as PaymentStatus,
  quotation_status as QuotationStatus,
  role_code as RoleCode,
  shipmentjob_serviceScope as ServiceScope,
  shipmentrequest_status as ShipmentRequestStatus,
  shipmentjob_shipmentType as ShipmentType,
  shipmentjob_transportMode as TransportMode,
  vendorbill_status as VendorBillStatus,
  vendor_type as VendorType,
  shipmentworkflowstep_phase as WorkflowPhase,
  shipmentworkflowstep_status as WorkflowStepStatus,
  shipmentworkflowstep_visibility as WorkflowVisibility,
} from "../lib/generated/prisma/enums";

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
const DEMO_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin123";
const now = new Date("2026-07-06T09:00:00.000Z");
const oneDay = 24 * 60 * 60 * 1000;

type DemoUserKey = "admin" | "operations" | "docs" | "accounts" | "sales";
type DemoCustomerKey = "portal" | "bengal" | "metro" | "global";
type DemoVendorKey = "ocean" | "airline" | "cfAgent" | "trucker" | "agent";
type DemoJobKey = "seaActive" | "airExport" | "doorDelivered" | "financeOpen" | "financeLocked";

type TrimSummary = {
  customersBefore: number;
  customersAfter: number;
  vendorsBefore: number;
  vendorsAfter: number;
  customersDeleted: number;
  customersInactivated: number;
  vendorsDeleted: number;
  vendorsInactivated: number;
  preservedCustomers: string[];
  preservedVendors: string[];
};

function dateFromNow(days: number) {
  return new Date(now.getTime() + days * oneDay);
}

async function deleteDemoTransactions(companyId: string) {
  await prisma.$transaction(
    async (tx) => {
      await tx.taskcomment.deleteMany({ where: { companyId } });
      await tx.task.deleteMany({ where: { companyId } });
      await tx.notificationdelivery.deleteMany({ where: { companyId } });
      await tx.notification.deleteMany({ where: { companyId } });
      await tx.customerportalactivationtoken.deleteMany({ where: { companyId } });
      await tx.documentapproval.deleteMany({ where: { freightdocument: { companyId } } });
      await tx.documentversion.deleteMany({ where: { freightdocument: { companyId } } });
      await tx.freightdocument.deleteMany({ where: { companyId } });
      await tx.shipmentdocument.deleteMany({ where: { companyId } });
      await tx.workflowstagerequirement.deleteMany({
        where: { shipmentworkflowstage: { shipmentworkflow: { shipmentjob: { companyId } } } },
      });
      await tx.workflowstagetransition.deleteMany({
        where: { shipmentworkflow: { shipmentjob: { companyId } } },
      });
      await tx.workflowstageaudit.deleteMany({
        where: { shipmentworkflow: { shipmentjob: { companyId } } },
      });
      await tx.workflowoverride.deleteMany({
        where: { shipmentworkflow: { shipmentjob: { companyId } } },
      });
      await tx.shipmentworkflowstage.deleteMany({
        where: { shipmentworkflow: { shipmentjob: { companyId } } },
      });
      await tx.shipmentworkflow.deleteMany({ where: { shipmentjob: { companyId } } });
      await tx.shipmentworkflowstep.deleteMany({ where: { companyId } });
      await tx.cargoreleasechecklist.deleteMany({ where: { companyId } });
      await tx.prealert.deleteMany({ where: { companyId } });
      await tx.billoflading.deleteMany({ where: { companyId } });
      await tx.shippinginstruction.deleteMany({ where: { companyId } });
      await tx.stuffingplan.deleteMany({ where: { companyId } });
      await tx.freightbooking.deleteMany({ where: { companyId } });
      await tx.carrierproposal.deleteMany({ where: { companyId } });
      await tx.carrierquery.deleteMany({ where: { companyId } });
      await tx.payment.deleteMany({ where: { companyId } });
      await tx.invoiceline.deleteMany({ where: { companyId } });
      await tx.vendorbillline.deleteMany({ where: { companyId } });
      await tx.invoice.deleteMany({ where: { companyId } });
      await tx.vendorbill.deleteMany({ where: { companyId } });
      await tx.shipmentcostitem.deleteMany({ where: { companyId } });
      await tx.quotationcharge.deleteMany({ where: { companyId } });
      await tx.quotation.deleteMany({ where: { companyId } });
      await tx.container.deleteMany({ where: { companyId } });
      await tx.shipmentstatusevent.deleteMany({ where: { companyId } });
      await tx.shipmentjob.deleteMany({ where: { companyId } });
      await tx.shipmentrequest.deleteMany({ where: { companyId } });
      await tx.shipmentjobsequence.deleteMany({ where: { companyId } });
      await tx.quotationsequence.deleteMany({ where: { companyId } });
      await tx.shipmentrequestsequence.deleteMany({ where: { companyId } });
      await tx.invoicesequence.deleteMany({ where: { companyId } });
      await tx.vendorbillsequence.deleteMany({ where: { companyId } });
      await tx.paymentsequence.deleteMany({ where: { companyId } });
      await tx.freightdocumentsequence.deleteMany({ where: { companyId } });
    },
    { timeout: 60000 },
  );
}

async function upsertCompanyUser({
  companyId,
  email,
  name,
  roleCode,
}: {
  companyId: string;
  email: string;
  name: string;
  roleCode: RoleCode;
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      id: randomUUID(),
      updatedAt: new Date(),
      companyId,
      name,
      scope: "COMPANY",
      status: "ACTIVE",
      passwordHash,
      deletedAt: null,
    },
    create: { id: randomUUID(), updatedAt: new Date(),
      companyId,
      email,
      name,
      scope: "COMPANY",
      status: "ACTIVE",
      passwordHash,
    },
  });

  const role = await prisma.role.findFirstOrThrow({
    where: { companyId, code: roleCode },
    select: { id: true },
  });

  await prisma.userrole.deleteMany({ where: { userId: user.id } });
  await prisma.userrole.create({ data: { id: randomUUID(), userId: user.id, roleId: role.id } });

  return user;
}

async function upsertCustomer(companyId: string, data: { name: string; code: string; email: string; phone: string; address: string }) {
  const existing = await prisma.customer.findFirst({ where: { companyId, code: data.code } });
  if (existing) {
    return prisma.customer.update({
      where: { id: existing.id },
      data: { ...data, status: PartyStatus.ACTIVE, deletedAt: null },
    });
  }

  return prisma.customer.create({
    data: { id: randomUUID(), updatedAt: new Date(), companyId, ...data, status: PartyStatus.ACTIVE },
  });
}

async function upsertVendor(
  companyId: string,
  data: { name: string; type: VendorType; email: string; phone: string; address: string; paymentTerms: string; notes: string },
) {
  const existing = await prisma.vendor.findFirst({ where: { companyId, name: data.name } });
  if (existing) {
    return prisma.vendor.update({
      where: { id: existing.id },
      data: { ...data, status: PartyStatus.ACTIVE, deletedAt: null },
    });
  }

  return prisma.vendor.create({
    data: { id: randomUUID(), updatedAt: new Date(), companyId, ...data, status: PartyStatus.ACTIVE },
  });
}

async function upsertBranch(companyId: string, code: string, name: string) {
  const existing = await prisma.branch.findFirst({ where: { companyId, code } });
  if (existing) {
    return prisma.branch.update({ where: { id: existing.id }, data: { name, isActive: true, deletedAt: null } });
  }
  return prisma.branch.create({ data: { id: randomUUID(), updatedAt: new Date(), companyId, code, name, isActive: true } });
}

async function upsertBranchMembership(userId: string, branchId: string, isDefault: boolean) {
  if (isDefault) {
    await prisma.userbranchmembership.updateMany({
      where: { userId, branchId: { not: branchId } },
      data: { isDefault: false },
    });
  }
  await prisma.userbranchmembership.upsert({
    where: { userId_branchId: { userId, branchId } },
    update: { isDefault },
    create: { id: randomUUID(), updatedAt: new Date(), userId, branchId, isDefault },
  });
}

async function trimDemoMasterData({
  companyId,
  preserveCustomerIds,
  preserveVendorIds,
}: {
  companyId: string;
  preserveCustomerIds: string[];
  preserveVendorIds: string[];
}): Promise<TrimSummary> {
  const [customersBefore, vendorsBefore] = await Promise.all([
    prisma.customer.count({ where: { companyId, status: PartyStatus.ACTIVE } }),
    prisma.vendor.count({ where: { companyId, status: PartyStatus.ACTIVE } }),
  ]);

  const customerDeleteWhere = {
    id: randomUUID(),
    updatedAt: new Date(),
    companyId,
    id: { notIn: preserveCustomerIds },
    clientportalaccount: { none: {} },
    user: { none: {} },
    shipmentjob: { none: {} },
    quotation: { none: {} },
    shipmentcostitem: { none: {} },
    invoice: { none: {} },
    payment: { none: {} },
    shipmentrequest: { none: {} },
    customerportalactivationtoken: { none: {} },
    task: { none: {} },
  };

  const deletableCustomers = await prisma.customer.findMany({
    where: customerDeleteWhere,
    select: { id: true },
  });
  const deletableCustomerIds = deletableCustomers.map((customer) => customer.id);

  if (deletableCustomerIds.length > 0) {
    await prisma.customercontact.deleteMany({
      where: { customerId: { in: deletableCustomerIds } },
    });
  }
  const customersDeleted = await prisma.customer.deleteMany({
    where: { id: { in: deletableCustomerIds } },
  });

  const customersInactivated = await prisma.customer.updateMany({
    where: {
      id: randomUUID(),
      updatedAt: new Date(),
      companyId,
      id: { notIn: preserveCustomerIds },
      status: PartyStatus.ACTIVE,
    },
    data: {
      status: PartyStatus.INACTIVE,
    },
  });

  const vendorDeleteWhere = {
    id: randomUUID(),
    updatedAt: new Date(),
    companyId,
    id: { notIn: preserveVendorIds },
    task: { none: {} },
    quotationcharge: { none: {} },
    shipmentcostitem: { none: {} },
    vendorbill: { none: {} },
    payment: { none: {} },
    shipmentworkflowstep: { none: {} },
    carrierquery: { none: {} },
    carrierproposal: { none: {} },
    freightbooking: { none: {} },
    prealert: { none: {} },
  };

  const deletableVendors = await prisma.vendor.findMany({
    where: vendorDeleteWhere,
    select: { id: true },
  });
  const deletableVendorIds = deletableVendors.map((vendor) => vendor.id);

  if (deletableVendorIds.length > 0) {
    await prisma.vendorcontact.deleteMany({
      where: { vendorId: { in: deletableVendorIds } },
    });
  }
  const vendorsDeleted = await prisma.vendor.deleteMany({
    where: { id: { in: deletableVendorIds } },
  });

  const vendorsInactivated = await prisma.vendor.updateMany({
    where: {
      id: randomUUID(),
      updatedAt: new Date(),
      companyId,
      id: { notIn: preserveVendorIds },
      status: PartyStatus.ACTIVE,
    },
    data: {
      status: PartyStatus.INACTIVE,
    },
  });

  const [customersAfter, vendorsAfter, preservedCustomers, preservedVendors] = await Promise.all([
    prisma.customer.count({ where: { companyId, status: PartyStatus.ACTIVE } }),
    prisma.vendor.count({ where: { companyId, status: PartyStatus.ACTIVE } }),
    prisma.customer.findMany({
      where: { id: { in: preserveCustomerIds } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
    prisma.vendor.findMany({
      where: { id: { in: preserveVendorIds } },
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  return {
    customersBefore,
    customersAfter,
    vendorsBefore,
    vendorsAfter,
    customersDeleted: customersDeleted.count,
    customersInactivated: customersInactivated.count,
    vendorsDeleted: vendorsDeleted.count,
    vendorsInactivated: vendorsInactivated.count,
    preservedCustomers: preservedCustomers.map((customer) => customer.name),
    preservedVendors: preservedVendors.map((vendor) => vendor.name),
  };
}

function shipmentBase({
  companyId,
  customerId,
  adminId,
  jobNo,
  shipmentType,
  transportMode,
  loadType,
  serviceScope,
  originCountry,
  originPort,
  destinationCountry,
  destinationPort,
  cargoDescription,
}: {
  companyId: string;
  customerId: string;
  adminId: string;
  jobNo: string;
  shipmentType: ShipmentType;
  transportMode: TransportMode;
  loadType: LoadType;
  serviceScope: ServiceScope;
  originCountry: string;
  originPort?: string;
  destinationCountry: string;
  destinationPort?: string;
  cargoDescription: string;
}) {
  return {
    id: randomUUID(),
    updatedAt: new Date(),
    companyId,
    customerId,
    jobNo,
    shipmentType,
    transportMode,
    loadType,
    serviceScope,
    originCountry,
    originPort,
    destinationCountry,
    destinationPort,
    cargoDescription,
    assignedToId: adminId,
    createdById: adminId,
  };
}

async function createQuotation({
  companyId,
  branchId,
  customerId,
  createdById,
  quoteNo,
  status,
  shipmentType,
  transportMode,
  loadType,
  serviceScope,
  originCountry,
  originPort,
  destinationCountry,
  destinationPort,
  cargoDescription,
}: {
  companyId: string;
  branchId: string;
  customerId: string;
  createdById: string;
  quoteNo: string;
  status: QuotationStatus;
  shipmentType: ShipmentType;
  transportMode: TransportMode;
  loadType: LoadType;
  serviceScope: ServiceScope;
  originCountry: string;
  originPort?: string;
  destinationCountry: string;
  destinationPort?: string;
  cargoDescription: string;
}) {
  const request = await prisma.shipmentrequest.create({
    data: { id: randomUUID(), updatedAt: new Date(),
      companyId,
      branchId,
      customerId,
      requestNo: quoteNo.replace("QT", "REQ"),
      status:
        status === QuotationStatus.ACCEPTED
          ? ShipmentRequestStatus.ACCEPTED
          : status === QuotationStatus.REJECTED
            ? ShipmentRequestStatus.REJECTED
            : ShipmentRequestStatus.UNDER_REVIEW,
      shipmentType,
      transportMode,
      serviceScope,
      loadType,
      originCountry,
      originPort,
      destinationCountry,
      destinationPort,
      cargoDescription,
      customerReference: `${quoteNo} demo request`,
      createdById,
      source: "DEMO_SEED",
      submittedAt: dateFromNow(-18),
      quotedAt: status === QuotationStatus.SENT ? dateFromNow(-2) : dateFromNow(-10),
    },
  });

  const quotation = await prisma.quotation.create({
    data: { id: randomUUID(), updatedAt: new Date(),
      companyId,
      branchId,
      customerId,
      shipmentRequestId: request.id,
      quoteNo,
      status,
      shipmentType,
      transportMode,
      loadType,
      originCountry,
      originPort,
      destinationCountry,
      destinationPort,
      cargoDescription,
      createdById,
      approvedById: status === QuotationStatus.ACCEPTED ? createdById : null,
      approvedAt: status === QuotationStatus.ACCEPTED ? dateFromNow(-8) : null,
      validUntil: dateFromNow(14),
      remarks: "Demo quotation for client presentation.",
    },
  });

  await prisma.quotationcharge.createMany({
    data: [
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId,
        quotationId: quotation.id,
        chargeName: "International freight",
        chargeType: ChargeType.FREIGHT,
        chargeBasis: ChargeBasis.PER_SHIPMENT,
        currency: CurrencyCode.USD,
        quantity: 1,
        buyRate: 1200,
        sellRate: 1550,
        exchangeRateToBDT: 110,
        buyAmount: 1200,
        sellAmount: 1550,
        profitAmount: 350,
        remarks: "Backoffice buy/sell rate; client sees sell charge only.",
      },
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId,
        quotationId: quotation.id,
        chargeName: "Documentation and handling",
        chargeType: ChargeType.DOCUMENTATION,
        chargeBasis: ChargeBasis.PER_SHIPMENT,
        currency: CurrencyCode.BDT,
        quantity: 1,
        buyRate: 6500,
        sellRate: 10000,
        exchangeRateToBDT: 1,
        buyAmount: 6500,
        sellAmount: 10000,
        profitAmount: 3500,
      },
    ],
  });

  return { request, quotation };
}

async function createFreightDocument({
  companyId,
  branchId,
  shipmentJobId,
  createdById,
  type,
  documentNo,
  status,
  isClientVisible,
  visibility,
  responsibility,
  handlingMode,
  referenceNo,
  issuedBy,
  remarks,
}: {
  companyId: string;
  branchId: string;
  shipmentJobId: string;
  createdById: string;
  type: FreightDocumentType;
  documentNo: string;
  status: FreightDocumentStatus;
  isClientVisible: boolean;
  visibility: FreightDocumentVisibility;
  responsibility: FreightDocumentResponsibility;
  handlingMode: FreightDocumentHandlingMode;
  referenceNo?: string;
  issuedBy?: string;
  remarks?: string;
}) {
  const doc = await prisma.freightdocument.create({
    data: { id: randomUUID(), updatedAt: new Date(),
      companyId,
      branchId,
      shipmentJobId,
      type,
      documentNo,
      status,
      isClientVisible,
      visibility,
      responsibility,
      handlingMode,
      referenceNo,
      issuedBy,
      issueDate: dateFromNow(-3),
      uploadedById: handlingMode === FreightDocumentHandlingMode.GENERATE_IN_SYSTEM ? null : createdById,
      verifiedById: status === FreightDocumentStatus.VERIFIED ? createdById : null,
      verifiedAt: status === FreightDocumentStatus.VERIFIED ? dateFromNow(-1) : null,
      lockedById: status === FreightDocumentStatus.LOCKED ? createdById : null,
      lockedAt: status === FreightDocumentStatus.LOCKED ? dateFromNow(-1) : null,
      remarks,
    },
  });

  if (
    handlingMode === FreightDocumentHandlingMode.GENERATE_IN_SYSTEM ||
    type === FreightDocumentType.HBL ||
    type === FreightDocumentType.HAWB ||
    type === FreightDocumentType.MANIFEST ||
    type === FreightDocumentType.DEBIT_NOTE
  ) {
    await prisma.documentversion.create({
      data: { id: randomUUID(),
        freightDocumentId: doc.id,
        versionNumber: 1,
        createdById,
        content: JSON.stringify({
          demo: true,
          documentNo,
          customerSafe: isClientVisible,
          note: "Demo metadata only. No uploaded file path is attached.",
        }),
        remarks: "Seeded demo document version.",
      },
    });
  }

  return doc;
}

async function createShipmentDocuments(companyId: string, branchId: string, shipmentJobId: string, userId: string, names: string[]) {
  for (const [index, name] of names.entries()) {
    await prisma.shipmentdocument.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        companyId,
        branchId,
        shipmentJobId,
        documentName: name,
        documentType: name,
        status: index % 2 === 0 ? DocumentStatus.VERIFIED : DocumentStatus.UPLOADED,
        remarks: "Seeded demo checklist document metadata only.",
        uploadedById: userId,
        uploadedAt: dateFromNow(-5 + index),
        verifiedById: index % 2 === 0 ? userId : null,
        verifiedAt: index % 2 === 0 ? dateFromNow(-4 + index) : null,
      },
    });
  }
}

async function createWorkflow(companyId: string, job: { id: string; shipmentType: ShipmentType; transportMode: TransportMode; loadType: LoadType; serviceScope: ServiceScope }, userId: string, progressPercent: number) {
  const template = await prisma.workflowtemplate.findFirst({
    where: {
      companyId: null,
      mode: job.transportMode,
      direction: job.shipmentType,
      loadType: job.loadType,
      serviceScope: job.serviceScope,
    },
    include: { workflowstagetemplate: { orderBy: { sortOrder: "asc" }, take: 6 } },
  });

  if (template) {
    const workflow = await prisma.shipmentworkflow.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        shipmentJobId: job.id,
        workflowTemplateId: template.id,
        progressPercent,
      },
    });

    for (const [index, stage] of template.workflowstagetemplate.entries()) {
      const complete = index < Math.round((template.workflowstagetemplate.length * progressPercent) / 100);
      await prisma.shipmentworkflowstage.create({
        data: { id: randomUUID(), updatedAt: new Date(),
          shipmentWorkflowId: workflow.id,
          stageCode: stage.stageCode,
          stageName: stage.stageName,
          sortOrder: stage.sortOrder,
          status: complete ? "COMPLETED" : index === 0 ? "IN_PROGRESS" : "PENDING",
          completedById: complete ? userId : null,
          completedAt: complete ? dateFromNow(-10 + index) : null,
        },
      });
    }
  }

  const legacySteps = [
    { key: "DOCUMENTS", title: "Documents", phase: WorkflowPhase.ORIGIN },
    { key: "DELIVERY_RELEASE", title: "Delivery Order / Gate Pass", phase: WorkflowPhase.DELIVERY },
    { key: "POD_CLOSEOUT", title: "POD and closeout", phase: WorkflowPhase.CLOSURE },
  ];

  for (const [index, step] of legacySteps.entries()) {
    const complete = index < Math.round((legacySteps.length * progressPercent) / 100);
    await prisma.shipmentworkflowstep.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        companyId,
        shipmentJobId: job.id,
        serviceScope: job.serviceScope,
        phase: step.phase,
        stepKey: step.key,
        title: step.title,
        description: "Demo workflow step for operational presentation.",
        sortOrder: (index + 1) * 10,
        isRequired: true,
        visibility: index === 0 ? WorkflowVisibility.CUSTOMER_VISIBLE : WorkflowVisibility.INTERNAL_ONLY,
        status: complete ? WorkflowStepStatus.COMPLETED : WorkflowStepStatus.IN_PROGRESS,
        assignedUserId: userId,
        startedAt: dateFromNow(-8 + index),
        completedAt: complete ? dateFromNow(-6 + index) : null,
        createdById: userId,
        updatedById: userId,
      },
    });
  }
}

async function createFinancePack({
  companyId,
  branchId,
  jobId,
  customerId,
  vendorId,
  adminId,
  invoiceNo,
  billNo,
  paymentNo,
  invoiceTotal,
  invoicePaid,
  vendorTotal,
  vendorPaid,
  createVendorPayment,
}: {
  companyId: string;
  branchId: string;
  jobId: string;
  customerId: string;
  vendorId: string;
  adminId: string;
  invoiceNo: string;
  billNo: string;
  paymentNo: string;
  invoiceTotal: number;
  invoicePaid: number;
  vendorTotal: number;
  vendorPaid: number;
  createVendorPayment?: boolean;
}) {
  const invoice = await prisma.invoice.create({
    data: { id: randomUUID(), updatedAt: new Date(),
      companyId,
      branchId,
      customerId,
      shipmentJobId: jobId,
      invoiceNo,
      status: invoicePaid >= invoiceTotal ? InvoiceStatus.PAID : invoicePaid > 0 ? InvoiceStatus.PARTIALLY_PAID : InvoiceStatus.SENT,
      invoiceDate: dateFromNow(-12),
      dueDate: dateFromNow(10),
      currency: CurrencyCode.BDT,
      subtotal: invoiceTotal,
      totalAmount: invoiceTotal,
      paidAmount: invoicePaid,
      dueAmount: invoiceTotal - invoicePaid,
      remarks: "Demo customer invoice.",
      createdById: adminId,
      sentAt: dateFromNow(-11),
      invoiceline: {
        create: { id: randomUUID(), updatedAt: new Date(),
          companyId,
          description: "Freight forwarding service",
          chargeType: ChargeType.FREIGHT,
          quantity: 1,
          unitPrice: invoiceTotal,
          amount: invoiceTotal,
        },
      },
    },
  });

  const vendorBill = await prisma.vendorbill.create({
    data: { id: randomUUID(), updatedAt: new Date(),
      companyId,
      branchId,
      vendorId,
      shipmentJobId: jobId,
      billNo,
      status: vendorPaid >= vendorTotal ? VendorBillStatus.PAID : vendorPaid > 0 ? VendorBillStatus.PARTIALLY_PAID : VendorBillStatus.RECEIVED,
      billDate: dateFromNow(-10),
      dueDate: dateFromNow(7),
      currency: CurrencyCode.BDT,
      subtotal: vendorTotal,
      totalAmount: vendorTotal,
      paidAmount: vendorPaid,
      dueAmount: vendorTotal - vendorPaid,
      remarks: "Demo vendor bill.",
      createdById: adminId,
      receivedAt: dateFromNow(-9),
      vendorbillline: {
        create: { id: randomUUID(), updatedAt: new Date(),
          companyId,
          description: "Vendor freight and handling cost",
          chargeType: ChargeType.FREIGHT,
          quantity: 1,
          unitPrice: vendorTotal,
          amount: vendorTotal,
        },
      },
    },
  });

  if (invoicePaid > 0) {
    await prisma.payment.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        companyId,
        branchId,
        paymentNo,
        direction: PaymentDirection.RECEIVED,
        status: PaymentStatus.CLEARED,
        customerId,
        invoiceId: invoice.id,
        shipmentJobId: jobId,
        paymentDate: dateFromNow(-3),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        referenceNo: `${paymentNo}-BANK`,
        currency: CurrencyCode.BDT,
        amount: invoicePaid,
        amountInBDT: invoicePaid,
        remarks: "Demo customer payment received.",
        createdById: adminId,
      },
    });
  }

  if (createVendorPayment && vendorPaid > 0) {
    await prisma.payment.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        companyId,
        branchId,
        paymentNo: paymentNo.replace("RCV", "PAY"),
        direction: PaymentDirection.PAID,
        status: PaymentStatus.CLEARED,
        vendorId,
        vendorBillId: vendorBill.id,
        shipmentJobId: jobId,
        paymentDate: dateFromNow(-2),
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        referenceNo: `${paymentNo}-VENDOR`,
        currency: CurrencyCode.BDT,
        amount: vendorPaid,
        amountInBDT: vendorPaid,
        remarks: "Demo vendor payment.",
        createdById: adminId,
      },
    });
  }

  return { invoice, vendorBill };
}

async function main() {
  const company = await prisma.company.findFirstOrThrow({
    where: { portalSlug: DEMO_COMPANY_SLUG },
    select: { id: true, name: true, portalSlug: true },
  });

  const platformUser = await prisma.user.findUnique({ where: { email: "platform@freightcontrol.com" } });
  const companyAdmin = await prisma.user.findUnique({ where: { email: "admin@freightcontrol.com" } });
  const portalAccount = await prisma.clientportalaccount.findFirst({
    where: { companyId: company.id, displayClientCode: DEMO_CLIENT_ID },
    include: { customer: true },
  });

  if (!platformUser || !companyAdmin || companyAdmin.companyId !== company.id || !portalAccount) {
    throw new Error("Required preserved platform/company/portal credentials are missing.");
  }

  await deleteDemoTransactions(company.id);

  const users: Record<DemoUserKey, { id: string; email: string }> = {
    admin: companyAdmin,
    operations: await upsertCompanyUser({
      id: randomUUID(),
      updatedAt: new Date(),
      companyId: company.id,
      email: "operations@freightcontrol.com",
      name: "Operations Officer",
      roleCode: RoleCode.OPERATIONS_MANAGER,
    }),
    docs: await upsertCompanyUser({
      id: randomUUID(),
      updatedAt: new Date(),
      companyId: company.id,
      email: "docs@freightcontrol.com",
      name: "Documentation Officer",
      roleCode: RoleCode.DOCUMENTATION_OFFICER,
    }),
    accounts: await upsertCompanyUser({
      id: randomUUID(),
      updatedAt: new Date(),
      companyId: company.id,
      email: "accounts@freightcontrol.com",
      name: "Accounts Officer",
      roleCode: RoleCode.ACCOUNTS_OFFICER,
    }),
    sales: await upsertCompanyUser({
      id: randomUUID(),
      updatedAt: new Date(),
      companyId: company.id,
      email: "sales@freightcontrol.com",
      name: "Sales Executive",
      roleCode: RoleCode.SALES_EXECUTIVE,
    }),
  };

  // Keep the demo idempotent and make tenant/branch isolation visible without
  // placing a second branch's records in a normal Head Office user's workload.
  const headOffice = await upsertBranch(company.id, "HEAD_OFFICE", "Head Office");
  const chattogramOps = await upsertBranch(company.id, "CTG_OPS", "Chattogram Operations");
  await Promise.all([
    upsertBranchMembership(users.admin.id, headOffice.id, true),
    upsertBranchMembership(users.docs.id, headOffice.id, true),
    upsertBranchMembership(users.accounts.id, headOffice.id, true),
    upsertBranchMembership(users.sales.id, headOffice.id, true),
    upsertBranchMembership(users.operations.id, chattogramOps.id, true),
  ]);
  // The Phase 01 migration backfill defaults every existing company user into
  // Head Office. Remove that stale membership for the operations user so the
  // demo genuinely restricts them to Chattogram Operations only.
  await prisma.userbranchmembership.deleteMany({
    where: { userId: users.operations.id, branchId: headOffice.id },
  });

  const customers: Record<DemoCustomerKey, { id: string; name: string }> = {
    portal: portalAccount.customer,
    bengal: await upsertCustomer(company.id, {
      name: "Bengal Apparel Export Ltd.",
      code: "BEN-APP",
      email: "ops@bengal-apparel.example",
      phone: "+8801711001001",
      address: "DEPZ Road, Savar, Dhaka, Bangladesh",
    }),
    metro: await upsertCustomer(company.id, {
      name: "Metro Electronics Importers",
      code: "MET-ELC",
      email: "logistics@metro-electronics.example",
      phone: "+8801711001002",
      address: "Gulshan Avenue, Dhaka, Bangladesh",
    }),
    global: await upsertCustomer(company.id, {
      name: "Global Trading & Logistics",
      code: "GTL",
      email: "supplychain@global-trading.example",
      phone: "+8801711001003",
      address: "Agrabad C/A, Chattogram, Bangladesh",
    }),
  };

  await prisma.customer.update({
    where: { id: portalAccount.customerId },
    data: { status: PartyStatus.ACTIVE, deletedAt: null },
  });

  const vendors: Record<DemoVendorKey, { id: string; name: string }> = {
    ocean: await upsertVendor(company.id, {
      name: "Blue Horizon Ocean Line",
      type: VendorType.SHIPPING_LINE,
      email: "bd.ops@bluehorizon.example",
      phone: "+8801712002001",
      address: "Chattogram Port Agency Building",
      paymentTerms: "Net 15",
      notes: "Fictional ocean carrier for demo jobs.",
    }),
    airline: await upsertVendor(company.id, {
      name: "SkyBridge Air Cargo",
      type: VendorType.AIRLINE,
      email: "cargo@skybridge.example",
      phone: "+8801712002002",
      address: "Cargo Village, Dhaka Airport",
      paymentTerms: "Net 10",
      notes: "Fictional air cargo provider.",
    }),
    cfAgent: await upsertVendor(company.id, {
      name: "Delta C&F Services",
      type: VendorType.C_AND_F_AGENT,
      email: "clearance@deltacf.example",
      phone: "+8801712002003",
      address: "Custom House Road, Chattogram",
      paymentTerms: "Net 7",
      notes: "Fictional C&F agent for customs clearance.",
    }),
    trucker: await upsertVendor(company.id, {
      name: "PrimeMover Delivery Fleet",
      type: VendorType.TRUCK_VENDOR,
      email: "dispatch@primemover.example",
      phone: "+8801712002004",
      address: "Tejgaon Truck Stand, Dhaka",
      paymentTerms: "Net 7",
      notes: "Fictional trucking and final delivery vendor.",
    }),
    agent: await upsertVendor(company.id, {
      name: "HarborLink Destination Agents",
      type: VendorType.OVERSEAS_AGENT,
      email: "destops@harborlink.example",
      phone: "+8801712002005",
      address: "Singapore Freeport",
      paymentTerms: "Net 30",
      notes: "Fictional destination agent.",
    }),
  };

  const trimSummary = await trimDemoMasterData({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    preserveCustomerIds: Object.values(customers).map((customer) => customer.id),
    preserveVendorIds: Object.values(vendors).map((vendor) => vendor.id),
  });

  await createQuotation({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    customerId: customers.metro.id,
    createdById: users.sales.id,
    quoteNo: "QT-DEMO-2026-0001",
    status: QuotationStatus.SENT,
    shipmentType: ShipmentType.IMPORT,
    transportMode: TransportMode.SEA,
    loadType: LoadType.FCL,
    serviceScope: ServiceScope.PORT_TO_PORT,
    originCountry: "China",
    originPort: "Ningbo",
    destinationCountry: "Bangladesh",
    destinationPort: "Chattogram",
    cargoDescription: "Consumer electronics, 1x40HC",
  });

  const quoteAccepted = await createQuotation({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    customerId: customers.portal.id,
    createdById: users.sales.id,
    quoteNo: "QT-DEMO-2026-0002",
    status: QuotationStatus.ACCEPTED,
    shipmentType: ShipmentType.IMPORT,
    transportMode: TransportMode.SEA,
    loadType: LoadType.FCL,
    serviceScope: ServiceScope.PORT_TO_PORT,
    originCountry: "China",
    originPort: "Shanghai",
    destinationCountry: "Bangladesh",
    destinationPort: "Chattogram",
    cargoDescription: "Retail garments and accessories",
  });

  await createQuotation({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    customerId: customers.global.id,
    createdById: users.sales.id,
    quoteNo: "QT-DEMO-2026-0003",
    status: QuotationStatus.REJECTED,
    shipmentType: ShipmentType.EXPORT,
    transportMode: TransportMode.AIR,
    loadType: LoadType.AIR_CARGO,
    serviceScope: ServiceScope.DOOR_TO_PORT,
    originCountry: "Bangladesh",
    originPort: "Dhaka",
    destinationCountry: "United Arab Emirates",
    destinationPort: "Dubai",
    cargoDescription: "Urgent trade sample shipment",
  });

  const jobs: Record<DemoJobKey, { id: string; jobNo: string; shipmentType: ShipmentType; transportMode: TransportMode; loadType: LoadType; serviceScope: ServiceScope; customerId: string }> = {
    seaActive: await prisma.shipmentjob.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        branchId: headOffice.id,
        ...shipmentBase({
          id: randomUUID(),
          updatedAt: new Date(),
          companyId: company.id,
          customerId: customers.portal.id,
          adminId: users.operations.id,
          jobNo: "JOB-DEMO-2026-0001",
          shipmentType: ShipmentType.IMPORT,
          transportMode: TransportMode.SEA,
          loadType: LoadType.FCL,
          serviceScope: ServiceScope.PORT_TO_PORT,
          originCountry: "China",
          originPort: "Shanghai",
          destinationCountry: "Bangladesh",
          destinationPort: "Chattogram",
          cargoDescription: "Apparel raw materials, 1x40HC container",
        }),
        currentStatus: "Active - documents pending",
        carrierName: vendors.ocean.name,
        shippingLineOrAirline: vendors.ocean.name,
        vesselName: "MV Demo Horizon",
        voyageNo: "DH226E",
        mblNo: "MBL-DEMO-0001",
        hblNo: "HBL-DEMO-0001",
        bookingNo: "BKG-DEMO-0001",
        etd: dateFromNow(-7),
        eta: dateFromNow(-1),
        commercialStatus: "Active workload",
        operationsStatus: "In transit - attention needed",
        documentStatus: "Missing required documents",
        financialStatus: "Finance open",
        workflowProgressPercent: 45,
        currentStageCode: "DOCUMENTS_PENDING",
        blockedStageCount: 1,
        missingRequirementList: "Packing List and Delivery Order pending",
        totalSellAmount: 195000,
        totalBuyAmount: 145000,
        grossProfit: 50000,
        profitMarginPercent: 25.64,
        financeCloseStatus: "OPEN",
      },
    }),
    airExport: await prisma.shipmentjob.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        branchId: headOffice.id,
        ...shipmentBase({
          id: randomUUID(),
          updatedAt: new Date(),
          companyId: company.id,
          customerId: customers.bengal.id,
          adminId: users.operations.id,
          jobNo: "JOB-DEMO-2026-0002",
          shipmentType: ShipmentType.EXPORT,
          transportMode: TransportMode.AIR,
          loadType: LoadType.AIR_CARGO,
          serviceScope: ServiceScope.DOOR_TO_PORT,
          originCountry: "Bangladesh",
          originPort: "Dhaka",
          destinationCountry: "Germany",
          destinationPort: "Frankfurt",
          cargoDescription: "Ready-made garments air shipment",
        }),
        currentStatus: "Air export in progress",
        carrierName: vendors.airline.name,
        shippingLineOrAirline: vendors.airline.name,
        flightNo: "SB-804",
        mawbNo: "MAWB-DEMO-0002",
        hawbNo: "HAWB-DEMO-0002",
        bookingNo: "AIR-DEMO-0002",
        etd: dateFromNow(1),
        eta: dateFromNow(3),
        commercialStatus: "Booked",
        operationsStatus: "Cargo handover in progress",
        documentStatus: "Air documents in progress",
        financialStatus: "Finance open",
        workflowProgressPercent: 35,
        totalSellAmount: 285000,
        totalBuyAmount: 220000,
        grossProfit: 65000,
        profitMarginPercent: 22.81,
        financeCloseStatus: "OPEN",
      },
    }),
    doorDelivered: await prisma.shipmentjob.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        branchId: headOffice.id,
        ...shipmentBase({
          id: randomUUID(),
          updatedAt: new Date(),
          companyId: company.id,
          customerId: customers.portal.id,
          adminId: users.operations.id,
          jobNo: "JOB-DEMO-2026-0003",
          shipmentType: ShipmentType.IMPORT,
          transportMode: TransportMode.SEA,
          loadType: LoadType.LCL,
          serviceScope: ServiceScope.DOOR_TO_DOOR,
          originCountry: "Singapore",
          originPort: "Singapore",
          destinationCountry: "Bangladesh",
          destinationPort: "Chattogram",
          cargoDescription: "LCL spare parts and accessories",
        }),
        currentStatus: "Delivered - POD verified",
        carrierName: vendors.ocean.name,
        deliveryAddress: "Demo Client warehouse, Dhaka",
        etd: dateFromNow(-20),
        eta: dateFromNow(-10),
        actualArrival: dateFromNow(-9),
        commercialStatus: "Delivered",
        operationsStatus: "POD verified",
        documentStatus: "Documents complete",
        financialStatus: "Close ready",
        workflowProgressPercent: 95,
        totalSellAmount: 130000,
        totalBuyAmount: 95000,
        grossProfit: 35000,
        profitMarginPercent: 26.92,
        financeCloseStatus: "CLOSE_READY",
        financeCloseReadyAt: dateFromNow(-2),
        financeCloseReadyById: users.accounts.id,
        deliveredAt: dateFromNow(-4),
        proofOfDeliveryAt: dateFromNow(-3),
      },
    }),
    financeOpen: await prisma.shipmentjob.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        branchId: headOffice.id,
        ...shipmentBase({
          id: randomUUID(),
          updatedAt: new Date(),
          companyId: company.id,
          customerId: customers.portal.id,
          adminId: users.operations.id,
          jobNo: "JOB-DEMO-2026-0004",
          shipmentType: ShipmentType.IMPORT,
          transportMode: TransportMode.LAND,
          loadType: LoadType.TRUCK,
          serviceScope: ServiceScope.DOOR_TO_DOOR,
          originCountry: "India",
          originPort: "Benapole",
          destinationCountry: "Bangladesh",
          destinationPort: "Dhaka",
          cargoDescription: "Door delivery commercial cargo",
        }),
        currentStatus: "Delivered - finance open",
        carrierName: vendors.trucker.name,
        deliveryAddress: "Demo Client distribution center, Gazipur",
        etd: dateFromNow(-12),
        eta: dateFromNow(-8),
        actualArrival: dateFromNow(-7),
        commercialStatus: "Delivered",
        operationsStatus: "Delivered",
        documentStatus: "POD received",
        financialStatus: "Delivered but finance open",
        workflowProgressPercent: 100,
        totalSellAmount: 92000,
        totalBuyAmount: 71000,
        grossProfit: 21000,
        profitMarginPercent: 22.83,
        financeCloseStatus: "OPEN",
        deliveredAt: dateFromNow(-6),
        proofOfDeliveryAt: dateFromNow(-5),
      },
    }),
    financeLocked: await prisma.shipmentjob.create({
      data: { id: randomUUID(), updatedAt: new Date(),
        branchId: headOffice.id,
        ...shipmentBase({
          id: randomUUID(),
          updatedAt: new Date(),
          companyId: company.id,
          customerId: customers.global.id,
          adminId: users.operations.id,
          jobNo: "JOB-DEMO-2026-0005",
          shipmentType: ShipmentType.EXPORT,
          transportMode: TransportMode.SEA,
          loadType: LoadType.FCL,
          serviceScope: ServiceScope.PORT_TO_PORT,
          originCountry: "Bangladesh",
          originPort: "Chattogram",
          destinationCountry: "United Kingdom",
          destinationPort: "Felixstowe",
          cargoDescription: "Finished garments export, 1x20GP",
        }),
        currentStatus: "Closed - finance locked",
        carrierName: vendors.ocean.name,
        hblNo: "HBL-DEMO-0005",
        mblNo: "MBL-DEMO-0005",
        etd: dateFromNow(-35),
        eta: dateFromNow(-5),
        actualDeparture: dateFromNow(-34),
        actualArrival: dateFromNow(-6),
        commercialStatus: "Closed",
        operationsStatus: "Job closed",
        documentStatus: "Documents complete",
        financialStatus: "Finance locked",
        workflowProgressPercent: 100,
        totalSellAmount: 420000,
        totalBuyAmount: 305000,
        grossProfit: 115000,
        profitMarginPercent: 27.38,
        financeCloseStatus: "LOCKED",
        financeCloseReadyAt: dateFromNow(-4),
        financeCloseReadyById: users.accounts.id,
        financeLockedAt: dateFromNow(-2),
        financeLockedById: users.accounts.id,
        finalTotalSellAmount: 420000,
        finalTotalBuyAmount: 305000,
        finalGrossProfit: 115000,
        finalProfitMarginPercent: 27.38,
        financeCloseNotes: "Final profit snapshot locked for demo reporting.",
        deliveredAt: dateFromNow(-6),
        proofOfDeliveryAt: dateFromNow(-5),
        closedAt: dateFromNow(-2),
      },
    }),
  };

  await prisma.shipmentrequest.update({
    where: { id: quoteAccepted.request.id },
    data: { convertedShipmentJobId: jobs.seaActive.id, convertedAt: dateFromNow(-8), status: ShipmentRequestStatus.CONVERTED },
  });
  await prisma.quotation.update({
    where: { id: quoteAccepted.quotation.id },
    data: { convertedShipmentJobId: jobs.seaActive.id, shipmentJobId: jobs.seaActive.id, status: QuotationStatus.CONVERTED },
  });

  for (const job of Object.values(jobs)) {
    await prisma.shipmentstatusevent.create({
      data: { id: randomUUID(),
        companyId: company.id,
        shipmentJobId: job.id,
        status: "Demo status updated",
        remarks: "Seeded status event for dashboard and reports.",
        updatedById: users.operations.id,
      },
    });
    await createWorkflow(company.id, job, users.operations.id, job.jobNo.endsWith("0001") ? 45 : job.jobNo.endsWith("0002") ? 35 : 100);
  }

  await createShipmentDocuments(company.id, headOffice.id, jobs.seaActive.id, users.docs.id, ["Commercial Invoice"]);
  await createShipmentDocuments(company.id, headOffice.id, jobs.airExport.id, users.docs.id, ["Commercial Invoice", "Packing List"]);
  await createShipmentDocuments(company.id, headOffice.id, jobs.doorDelivered.id, users.docs.id, ["Commercial Invoice", "Packing List", "POD"]);
  await createShipmentDocuments(company.id, headOffice.id, jobs.financeOpen.id, users.docs.id, ["Commercial Invoice", "Gate Pass", "POD"]);
  await createShipmentDocuments(company.id, headOffice.id, jobs.financeLocked.id, users.docs.id, ["Commercial Invoice", "Packing List", "Delivery Order", "POD"]);

  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.seaActive.id,
    createdById: users.docs.id,
    type: FreightDocumentType.HBL,
    documentNo: "HBL-DEMO-0001",
    status: FreightDocumentStatus.DRAFT,
    isClientVisible: true,
    visibility: FreightDocumentVisibility.CLIENT_SAFE,
    responsibility: FreightDocumentResponsibility.FORWARDER_GENERATED,
    handlingMode: FreightDocumentHandlingMode.GENERATE_IN_SYSTEM,
    remarks: "Draft HBL for active sea import.",
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.seaActive.id,
    createdById: users.docs.id,
    type: FreightDocumentType.MBL,
    documentNo: "MBL-DEMO-0001",
    status: FreightDocumentStatus.PENDING_RECEIPT,
    isClientVisible: false,
    visibility: FreightDocumentVisibility.INTERNAL_ONLY,
    responsibility: FreightDocumentResponsibility.CARRIER_ISSUED,
    handlingMode: FreightDocumentHandlingMode.TRACK_ONLY,
    referenceNo: "MBL-DEMO-0001",
    issuedBy: vendors.ocean.name,
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.airExport.id,
    createdById: users.docs.id,
    type: FreightDocumentType.HAWB,
    documentNo: "HAWB-DEMO-0002",
    status: FreightDocumentStatus.UNDER_REVIEW,
    isClientVisible: true,
    visibility: FreightDocumentVisibility.CLIENT_SAFE,
    responsibility: FreightDocumentResponsibility.FORWARDER_GENERATED,
    handlingMode: FreightDocumentHandlingMode.GENERATE_IN_SYSTEM,
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.airExport.id,
    createdById: users.docs.id,
    type: FreightDocumentType.MANIFEST,
    documentNo: "MAN-DEMO-0002",
    status: FreightDocumentStatus.DRAFT,
    isClientVisible: false,
    visibility: FreightDocumentVisibility.INTERNAL_ONLY,
    responsibility: FreightDocumentResponsibility.FORWARDER_GENERATED,
    handlingMode: FreightDocumentHandlingMode.GENERATE_IN_SYSTEM,
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.airExport.id,
    createdById: users.docs.id,
    type: FreightDocumentType.MAWB,
    documentNo: "MAWB-DEMO-0002",
    status: FreightDocumentStatus.RECEIVED,
    isClientVisible: false,
    visibility: FreightDocumentVisibility.INTERNAL_ONLY,
    responsibility: FreightDocumentResponsibility.AIRLINE_ISSUED,
    handlingMode: FreightDocumentHandlingMode.TRACK_ONLY,
    referenceNo: "MAWB-DEMO-0002",
    issuedBy: vendors.airline.name,
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.doorDelivered.id,
    createdById: users.docs.id,
    type: FreightDocumentType.DELIVERY_ORDER,
    documentNo: "DO-DEMO-0003",
    status: FreightDocumentStatus.VERIFIED,
    isClientVisible: true,
    visibility: FreightDocumentVisibility.CLIENT_SAFE,
    responsibility: FreightDocumentResponsibility.CARRIER_ISSUED,
    handlingMode: FreightDocumentHandlingMode.TRACK_ONLY,
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.doorDelivered.id,
    createdById: users.docs.id,
    type: FreightDocumentType.GATE_PASS,
    documentNo: "GP-DEMO-0003",
    status: FreightDocumentStatus.VERIFIED,
    isClientVisible: true,
    visibility: FreightDocumentVisibility.CLIENT_SAFE,
    responsibility: FreightDocumentResponsibility.AUTHORITY_ISSUED,
    handlingMode: FreightDocumentHandlingMode.TRACK_ONLY,
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.doorDelivered.id,
    createdById: users.docs.id,
    type: FreightDocumentType.POD,
    documentNo: "POD-DEMO-0003",
    status: FreightDocumentStatus.VERIFIED,
    isClientVisible: true,
    visibility: FreightDocumentVisibility.CLIENT_SAFE,
    responsibility: FreightDocumentResponsibility.CUSTOMER_PROVIDED,
    handlingMode: FreightDocumentHandlingMode.TRACK_ONLY,
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.financeOpen.id,
    createdById: users.accounts.id,
    type: FreightDocumentType.DEBIT_NOTE,
    documentNo: "DN-DEMO-0004",
    status: FreightDocumentStatus.DRAFT,
    isClientVisible: false,
    visibility: FreightDocumentVisibility.INTERNAL_ONLY,
    responsibility: FreightDocumentResponsibility.INTERNAL_FINANCE,
    handlingMode: FreightDocumentHandlingMode.GENERATE_IN_SYSTEM,
  });
  await createFreightDocument({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    shipmentJobId: jobs.financeLocked.id,
    createdById: users.docs.id,
    type: FreightDocumentType.HBL,
    documentNo: "HBL-DEMO-0005",
    status: FreightDocumentStatus.LOCKED,
    isClientVisible: true,
    visibility: FreightDocumentVisibility.CLIENT_SAFE,
    responsibility: FreightDocumentResponsibility.FORWARDER_GENERATED,
    handlingMode: FreightDocumentHandlingMode.GENERATE_IN_SYSTEM,
  });

  await prisma.cargoreleasechecklist.createMany({
    data: [
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId: company.id,
        shipmentJobId: jobs.seaActive.id,
        status: "DOCUMENTS_PENDING",
        arrived: true,
        arrivedAt: dateFromNow(-1),
        deliveryOrderReleased: false,
        cargoReleased: false,
        delivered: false,
        deliveryOrderNo: "DO-PENDING-DEMO-0001",
      },
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId: company.id,
        shipmentJobId: jobs.airExport.id,
        status: "READY_FOR_RELEASE",
        arrived: false,
        deliveryOrderReleased: false,
        cargoReleased: false,
        delivered: false,
      },
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId: company.id,
        shipmentJobId: jobs.doorDelivered.id,
        status: "DELIVERED",
        arrived: true,
        arrivedAt: dateFromNow(-8),
        deliveryOrderReleased: true,
        customsReady: true,
        cargoReleased: true,
        cargoReleasedAt: dateFromNow(-5),
        outForDeliveryAt: dateFromNow(-4),
        delivered: true,
        deliveredAt: dateFromNow(-4),
        deliveryLocation: "Demo Client warehouse",
        gatePassNo: "GP-DEMO-0003",
        deliveryOrderNo: "DO-DEMO-0003",
        podReferenceNo: "POD-DEMO-0003",
        verifiedBy: "Documentation Officer",
        verifiedAt: dateFromNow(-3),
      },
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId: company.id,
        shipmentJobId: jobs.financeOpen.id,
        status: "DELIVERED",
        arrived: true,
        arrivedAt: dateFromNow(-7),
        deliveryOrderReleased: true,
        cargoReleased: true,
        cargoReleasedAt: dateFromNow(-6),
        outForDeliveryAt: dateFromNow(-6),
        delivered: true,
        deliveredAt: dateFromNow(-5),
        deliveryLocation: "Gazipur distribution center",
        gatePassNo: "GP-DEMO-0004",
        podReferenceNo: "POD-DEMO-0004",
        verifiedBy: "Operations Officer",
        verifiedAt: dateFromNow(-4),
      },
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId: company.id,
        shipmentJobId: jobs.financeLocked.id,
        status: "DELIVERED",
        arrived: true,
        arrivedAt: dateFromNow(-6),
        deliveryOrderReleased: true,
        cargoReleased: true,
        cargoReleasedAt: dateFromNow(-5),
        delivered: true,
        deliveredAt: dateFromNow(-5),
        podReferenceNo: "POD-DEMO-0005",
        verifiedBy: "Operations Officer",
        verifiedAt: dateFromNow(-4),
      },
    ],
  });

  await prisma.shipmentcostitem.createMany({
    data: [
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId: company.id,
        shipmentJobId: jobs.seaActive.id,
        customerId: customers.portal.id,
        vendorId: vendors.ocean.id,
        sourceQuotationId: quoteAccepted.quotation.id,
        chargeName: "Ocean freight",
        chargeType: ChargeType.FREIGHT,
        chargeBasis: ChargeBasis.PER_SHIPMENT,
        currency: CurrencyCode.BDT,
        quantity: 1,
        buyRate: 145000,
        sellRate: 195000,
        buyAmount: 145000,
        sellAmount: 195000,
        profitAmount: 50000,
        createdById: users.accounts.id,
      },
      {
        id: randomUUID(),
        updatedAt: new Date(),
        companyId: company.id,
        shipmentJobId: jobs.financeLocked.id,
        customerId: customers.global.id,
        vendorId: vendors.ocean.id,
        chargeName: "Export sea freight",
        chargeType: ChargeType.FREIGHT,
        chargeBasis: ChargeBasis.PER_SHIPMENT,
        currency: CurrencyCode.BDT,
        quantity: 1,
        buyRate: 305000,
        sellRate: 420000,
        buyAmount: 305000,
        sellAmount: 420000,
        profitAmount: 115000,
        createdById: users.accounts.id,
      },
    ],
  });

  await createFinancePack({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    jobId: jobs.seaActive.id,
    customerId: customers.portal.id,
    vendorId: vendors.ocean.id,
    adminId: users.accounts.id,
    invoiceNo: "INV-DEMO-2026-0001",
    billNo: "VB-DEMO-2026-0001",
    paymentNo: "RCV-DEMO-2026-0001",
    invoiceTotal: 195000,
    invoicePaid: 0,
    vendorTotal: 145000,
    vendorPaid: 0,
  });
  await createFinancePack({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    jobId: jobs.financeOpen.id,
    customerId: customers.portal.id,
    vendorId: vendors.trucker.id,
    adminId: users.accounts.id,
    invoiceNo: "INV-DEMO-2026-0004",
    billNo: "VB-DEMO-2026-0004",
    paymentNo: "RCV-DEMO-2026-0004",
    invoiceTotal: 92000,
    invoicePaid: 46000,
    vendorTotal: 71000,
    vendorPaid: 0,
  });
  await createFinancePack({
    id: randomUUID(),
    updatedAt: new Date(),
    companyId: company.id,
    branchId: headOffice.id,
    jobId: jobs.financeLocked.id,
    customerId: customers.global.id,
    vendorId: vendors.ocean.id,
    adminId: users.accounts.id,
    invoiceNo: "INV-DEMO-2026-0005",
    billNo: "VB-DEMO-2026-0005",
    paymentNo: "RCV-DEMO-2026-0005",
    invoiceTotal: 420000,
    invoicePaid: 420000,
    vendorTotal: 305000,
    vendorPaid: 305000,
    createVendorPayment: true,
  });

  await prisma.notification.create({
    data: { id: randomUUID(), updatedAt: new Date(),
      companyId: company.id,
      clientPortalAccountId: portalAccount.id,
      scope: "CLIENT_PORTAL",
      type: "INFO",
      title: "Demo shipment update",
      message: "Your demo shipment has new delivery progress.",
      linkUrl: `/portal/${company.portalSlug}/shipments/${jobs.doorDelivered.id}`,
    },
  });

  await Promise.all([
    prisma.shipmentjobsequence.upsert({
      where: { companyId_year: { companyId: company.id, year: 2026 } },
      update: { currentSequence: 5 },
      create: { id: randomUUID(), updatedAt: new Date(), companyId: company.id, year: 2026, currentSequence: 5 },
    }),
    prisma.quotationsequence.upsert({
      where: { companyId_year: { companyId: company.id, year: 2026 } },
      update: { currentSequence: 3 },
      create: { id: randomUUID(), updatedAt: new Date(), companyId: company.id, year: 2026, currentSequence: 3 },
    }),
    prisma.shipmentrequestsequence.upsert({
      where: { companyId_year: { companyId: company.id, year: 2026 } },
      update: { currentSequence: 3 },
      create: { id: randomUUID(), updatedAt: new Date(), companyId: company.id, year: 2026, currentSequence: 3 },
    }),
    prisma.invoicesequence.upsert({
      where: { companyId_year: { companyId: company.id, year: 2026 } },
      update: { currentSequence: 5 },
      create: { id: randomUUID(), updatedAt: new Date(), companyId: company.id, year: 2026, currentSequence: 5 },
    }),
    prisma.vendorbillsequence.upsert({
      where: { companyId_year: { companyId: company.id, year: 2026 } },
      update: { currentSequence: 5 },
      create: { id: randomUUID(), updatedAt: new Date(), companyId: company.id, year: 2026, currentSequence: 5 },
    }),
    prisma.paymentsequence.upsert({
      where: { companyId_year: { companyId: company.id, year: 2026 } },
      update: { currentSequence: 5 },
      create: { id: randomUUID(), updatedAt: new Date(), companyId: company.id, year: 2026, currentSequence: 5 },
    }),
  ]);

  const summary = {
    customers: await prisma.customer.count({ where: { companyId: company.id } }),
    vendors: await prisma.vendor.count({ where: { companyId: company.id } }),
    quotations: await prisma.quotation.count({ where: { companyId: company.id } }),
    shipments: await prisma.shipmentjob.count({ where: { companyId: company.id } }),
    freightDocuments: await prisma.freightdocument.count({ where: { companyId: company.id } }),
    shipmentDocuments: await prisma.shipmentdocument.count({ where: { companyId: company.id } }),
    deliveryRecords: await prisma.cargoreleasechecklist.count({ where: { companyId: company.id } }),
    invoices: await prisma.invoice.count({ where: { companyId: company.id } }),
    vendorBills: await prisma.vendorbill.count({ where: { companyId: company.id } }),
    payments: await prisma.payment.count({ where: { companyId: company.id } }),
    portalVisibleShipments: await prisma.shipmentjob.count({ where: { companyId: company.id, customerId: portalAccount.customerId } }),
    financeLockedJobs: await prisma.shipmentjob.count({ where: { companyId: company.id, financeCloseStatus: "LOCKED" } }),
    financeOpenDeliveredJobs: await prisma.shipmentjob.count({
      where: { companyId: company.id, financeCloseStatus: "OPEN", deliveredAt: { not: null } },
    }),
  };

  console.log("Phase 18A demo data pack seeded.");
  console.log(`Demo company: ${company.name} (${company.portalSlug})`);
  console.log(`Users preserved/created: ${Object.keys(users).length} company users + preserved platform and portal login`);
  console.log(`Customers: ${summary.customers}`);
  console.log(`Vendors: ${summary.vendors}`);
  console.log(`Quotations: ${summary.quotations}`);
  console.log(`Shipments/jobs: ${summary.shipments}`);
  console.log(`Documents: ${summary.freightDocuments + summary.shipmentDocuments}`);
  console.log(`Delivery/POD records: ${summary.deliveryRecords}`);
  console.log(`Invoices: ${summary.invoices}`);
  console.log(`Vendor bills: ${summary.vendorBills}`);
  console.log(`Payments: ${summary.payments}`);
  console.log(`Finance locked jobs: ${summary.financeLockedJobs}`);
  console.log(`Finance open/delivered jobs: ${summary.financeOpenDeliveredJobs}`);
  console.log(`Portal-visible shipments: ${summary.portalVisibleShipments}`);
  console.log("Master data trim:");
  console.log(`- Customers before: ${trimSummary.customersBefore}`);
  console.log(`- Customers after: ${trimSummary.customersAfter}`);
  console.log(`- Customers deleted: ${trimSummary.customersDeleted}`);
  console.log(`- Customers inactivated: ${trimSummary.customersInactivated}`);
  console.log(`- Vendors before: ${trimSummary.vendorsBefore}`);
  console.log(`- Vendors after: ${trimSummary.vendorsAfter}`);
  console.log(`- Vendors deleted: ${trimSummary.vendorsDeleted}`);
  console.log(`- Vendors inactivated: ${trimSummary.vendorsInactivated}`);
  console.log(`- Preserved customers: ${trimSummary.preservedCustomers.join(", ")}`);
  console.log(`- Preserved vendors: ${trimSummary.preservedVendors.join(", ")}`);
}

main()
  .catch((error) => {
    console.error("Phase 18A demo data seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
