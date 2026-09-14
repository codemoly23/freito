import "dotenv/config";
import crypto from "crypto";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../lib/generated/prisma/client";
import { role_code as RoleCode } from "../lib/generated/prisma/client";
import { defaultWorkflowTemplates } from "../lib/shipments/workflow-templates";
import {
  companyPermissionDefinitions,
  COMPANY_ROLE_CODES,
  COMPANY_ROLE_NAMES,
  COMPANY_ROLE_PERMISSIONS,
  SEED_ONLY_COMPANY_PERMISSION_DEFINITIONS,
} from "../lib/permissions/company-role-permissions";
import { DOCUMENT_MASTER } from "../lib/documents/config";
import {
  externalNotificationChannels,
  systemNotificationTemplateDefinitions,
  portalAccessTemplateDefinitions,
  clientShareTemplateDefinitions,
} from "../lib/notifications/template-definitions";

function createSeedAdapter() {
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
    connectTimeout: 30000,
    allowPublicKeyRetrieval: !isAzure,
    ssl: isAzure
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
  });
}

const modelsWithUpdatedAt = new Set([
  "billoflading", "cargoreleasechecklist", "carrierproposal", "carrierquery",
  "clientportalaccount", "clientportalsequence", "communicationaccount", "company",
  "companymoduleaccess", "companysubscription", "container", "customer",
  "customercontact", "customerportalactivationtoken", "documentapproval",
  "documentchecklistitem", "freightbooking", "freightdocument", "freightdocumentsequence",
  "invoice", "invoiceline", "invoicesequence", "notification", "notificationdelivery",
  "notificationtemplate", "payment", "paymentsequence", "permission", "prealert",
  "quotation", "quotationcharge", "quotationsequence", "role", "shipmentcostitem",
  "shipmentdocument", "shipmentjob", "shipmentjobsequence", "shipmentrequest",
  "shipmentrequestsequence", "shipmentworkflow", "shipmentworkflowstage",
  "shipmentworkflowstep", "shipmentworkflowtemplatestep", "shippinginstruction",
  "stuffingplan", "task", "taskcomment", "user", "vendor", "vendorbill",
  "vendorbillline", "vendorbillsequence", "vendorcontact", "workflowstagerequirement",
  "workflowstagetemplate", "workflowtemplate",
]);

function withGeneratedFields(model: string, data: object) {
  const extra: Record<string, unknown> = { id: crypto.randomUUID() };
  if (modelsWithUpdatedAt.has(model.toLowerCase())) {
    extra.updatedAt = new Date();
  }
  return { ...extra, ...data };
}

const extendedPrisma = new PrismaClient({ adapter: createSeedAdapter() }).$extends({
  query: {
    $allModels: {
      async create({ model, args, query }) {
        args.data = withGeneratedFields(model, args.data as object);
        return query(args);
      },
      async createMany({ model, args, query }) {
        args.data = Array.isArray(args.data)
          ? args.data.map((row) => withGeneratedFields(model, row))
          : withGeneratedFields(model, args.data as object);
        return query(args);
      },
      async upsert({ model, args, query }) {
        args.create = withGeneratedFields(model, args.create as object);
        return query(args);
      },
    },
  },
});

// Model names in schema.prisma are all-lowercase (e.g. "companysubscription"), but this
// script (like the rest of the app) calls them with camelCase (e.g. companySubscription).
// Mirror the lowercase-fallback Proxy from lib/db/prisma.ts so those calls resolve.
const prisma = new Proxy(extendedPrisma, {
  get(target, prop, receiver) {
    if (typeof prop === "string" && !(prop in target)) {
      const lower = prop.toLowerCase();
      if (lower in target) {
        return (target as any)[lower];
      }
    }
    return Reflect.get(target, prop, receiver);
  },
}) as typeof extendedPrisma;

const platformPermissionDefinitions = [
  ["platform:companies:view", "View platform companies"],
  ["platform:companies:create", "Create platform companies"],
  ["platform:companies:update", "Update platform companies"],
  ["platform:companies:suspend", "Suspend or activate platform companies"],
  ["platform:subscriptions:view", "View subscriptions and licenses"],
  ["platform:subscriptions:update", "Update subscriptions"],
  ["platform:licenses:view", "View licenses"],
  ["platform:licenses:update", "Update licenses"],
  ["platform:modules:update", "Update module access"],
  ["platform:support:access", "Access platform support tools"],
  ["platform:audit:view", "View platform audit"],
] as const;

// Company permission catalogue + per-role grants live in
// lib/permissions/company-role-permissions.ts, shared with the live
// "Platform -> Companies" provisioning flow (lib/actions/platform.ts) so
// the two can never drift apart.
const seedOnlyPermissionDefinitions = SEED_ONLY_COMPANY_PERMISSION_DEFINITIONS;

const permissionDefinitions = [
  ...platformPermissionDefinitions,
  ...seedOnlyPermissionDefinitions,
  ...companyPermissionDefinitions,
] as const;

const platformPermissionKeys = platformPermissionDefinitions.map(([key]) => key);

const platformRoleCodes = [
  "PLATFORM_OWNER",
  "PLATFORM_ADMIN",
  "PLATFORM_SUPPORT",
  "PLATFORM_BILLING",
] as const;

const companyRoleCodes = COMPANY_ROLE_CODES;

const roleNames: Record<RoleCode, string> = {
  SUPER_ADMIN: "Legacy Super Admin",
  PLATFORM_OWNER: "Platform Owner",
  PLATFORM_ADMIN: "Platform Admin",
  PLATFORM_SUPPORT: "Platform Support",
  PLATFORM_BILLING: "Platform Billing",
  ...COMPANY_ROLE_NAMES,
};

const rolePermissions: Record<RoleCode, string[]> = {
  SUPER_ADMIN: [],
  PLATFORM_OWNER: platformPermissionKeys,
  PLATFORM_ADMIN: platformPermissionKeys,
  PLATFORM_SUPPORT: [
    "platform:companies:view",
    "platform:support:access",
    "platform:audit:view",
  ],
  PLATFORM_BILLING: [
    "platform:companies:view",
    "platform:subscriptions:view",
    "platform:subscriptions:update",
    "platform:licenses:view",
    "platform:licenses:update",
  ],
  ...COMPANY_ROLE_PERMISSIONS,
};



const defaultModules = [
  "SHIPMENTS",
  "DOCUMENTS",
  "QUOTATIONS",
  "COSTING",
  "BILLING",
  "REPORTS",
  "TASKS",
  "SHIPMENT_OPERATIONS",
  "CLIENT_PORTAL",
  "WHATSAPP_ALERTS",
  "API_ACCESS",
] as const;

async function upsertCompany() {
  const existing = await prisma.company.findFirst({
    where: { name: "FreightFast Demo Company" },
  });

  const data = {
    legalName: "FreightFast Demo Company Ltd.",
    email: "ops@freightcontrol.local",
    phone: "+8801700000000",
    address: "Dhaka, Bangladesh",
    status: "ACTIVE" as const,
    deploymentType: "CLOUD" as const,
    planType: "TRIAL" as const,
    subscriptionStatus: "ACTIVE" as const,
    maxUsers: 25,
    storageLimitMB: 10240,
    portalSlug: "demo-freight",
    portalDisplayName: "Demo Freight Client Portal",
    portalCodePrefix: "DFC",
    portalEnabled: true,
  };

  if (existing) {
    return prisma.company.update({
      where: { id: existing.id },
      data: {
        name: "FreightFast Demo Company",
        ...data,
      },
    });
  }

  return prisma.company.create({
    data: {
      name: "FreightFast Demo Company",
      ...data,
    },
  });
}

async function upsertRole({
  code,
  companyId,
  permissionByKey,
}: {
  code: RoleCode;
  companyId: string | null;
  permissionByKey: Map<string, { id: string }>;
}) {
  const existingRole = await prisma.role.findFirst({
    where: { companyId, code },
  });

  const role =
    existingRole ??
    (await prisma.role.create({
      data: {
        companyId,
        code,
        name: roleNames[code],
        isSystem: true,
      },
    }));

  await prisma.role.update({
    where: { id: role.id },
    data: {
      name: roleNames[code],
      isSystem: true,
      rolepermission: {
        deleteMany: {},
        create: rolePermissions[code].map((permissionKey) => ({
          id: crypto.randomUUID(),
          permissionId: permissionByKey.get(permissionKey)!.id,
        })),
      },
    },
  });

  return role;
}

async function main() {
  const company = await upsertCompany();
  const headOffice = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: "HEAD_OFFICE" } },
    update: {
      name: "Head Office",
      isActive: true,
      deletedAt: null,
      updatedAt: new Date(),
    },
    create: {
      id: crypto.randomUUID(),
      companyId: company.id,
      code: "HEAD_OFFICE",
      name: "Head Office",
      isActive: true,
      updatedAt: new Date(),
    },
  });

  for (const [key, name] of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { key },
      update: { name },
      create: { key, name },
    });
  }

  const allPermissions = await prisma.permission.findMany();
  const permissionByKey = new Map(
    allPermissions.map((permission) => [permission.key, permission]),
  );

  await prisma.companySubscription.upsert({
    where: { companyId: company.id },
    update: {
      planType: company.planType,
      deploymentType: company.deploymentType,
      status: company.subscriptionStatus,
      maxUsers: company.maxUsers,
      storageLimitMB: company.storageLimitMB,
    },
    create: {
      companyId: company.id,
      planType: company.planType,
      deploymentType: company.deploymentType,
      status: company.subscriptionStatus,
      maxUsers: company.maxUsers,
      storageLimitMB: company.storageLimitMB,
    },
  });

  for (const moduleKey of defaultModules) {
    await prisma.companymoduleaccess.upsert({
      where: { companyId_moduleKey: { companyId: company.id, moduleKey } },
      update: { isEnabled: true },
      create: { companyId: company.id, moduleKey, isEnabled: true },
    });
  }

  let sortOrder = 10;
  for (const item of DOCUMENT_MASTER) {
    const category = item.scope === "IMPORT_ONLY" ? "IMPORT" : item.scope === "EXPORT_ONLY" ? "EXPORT" : "COMMON";
    const isRequired = item.requirement === "MANDATORY";

    const existingChecklistItem = await prisma.documentChecklistItem.findFirst({
      where: {
        companyId: null,
        category,
        name: item.name,
      },
    });

    const checklistData = {
      code: item.code,
      owner: item.owner === 'FREIGHT_FORWARDER' ? 'FORWARDER' : item.owner,
      docCategory: item.owner === 'CUSTOMS' ? 'Customs' : (item.code.includes('invoice') || item.code.includes('note') ? 'Financial' : 'Shipping'),
      media: category,
      transportMode: item.transportMode === 'ALL' ? 'MULTIMODAL' : item.transportMode,
      isRequired,
      isOptional: !isRequired,
      sortOrder,
      isActive: true,
      
      // Seed default block gates
      mandatoryBeforeJobClose: isRequired && (item.code === 'hbl' || item.code === 'delivery_order' || item.code === 'customs_release'),
      mandatoryBeforeInvoice: isRequired && (item.code === 'commercial_invoice' || item.code === 'packing_list'),
      mandatoryBeforeDeliveryOrder: isRequired && (item.code === 'bill_of_entry' || item.code === 'duty_payment_doc' || item.code === 'master_bl' || item.code === 'master_awb'),
      mandatoryBeforeFinanceClose: isRequired && (item.code === 'freight_invoice'),
    };

    if (existingChecklistItem) {
      await prisma.documentChecklistItem.update({
        where: { id: existingChecklistItem.id },
        data: checklistData,
      });
    } else {
      await prisma.documentChecklistItem.create({
        data: {
          companyId: null,
          category,
          name: item.name,
          ...checklistData,
        },
      });
    }
    sortOrder += 10;
  }

  for (const template of defaultWorkflowTemplates) {
    const existingTemplate = await prisma.shipmentWorkflowTemplateStep.findFirst({
      where: {
        companyId: null,
        serviceScope: template.serviceScope,
        stepKey: template.stepKey,
      },
    });
    const templateData = {
      phase: template.phase,
      title: template.title,
      sortOrder: template.sortOrder,
      isRequired: template.isRequired,
      defaultVisibility: template.defaultVisibility,
      isActive: true,
    };

    if (existingTemplate) {
      await prisma.shipmentWorkflowTemplateStep.update({
        where: { id: existingTemplate.id },
        data: templateData,
      });
    } else {
      await prisma.shipmentWorkflowTemplateStep.create({
        data: {
          companyId: null,
          serviceScope: template.serviceScope,
          stepKey: template.stepKey,
          ...templateData,
        },
      });
    }
  }

  await prisma.shipmentWorkflowTemplateStep.updateMany({
    where: { stepKey: "CARGO_RELEASED" },
    data: { isActive: false },
  });

  for (const definition of systemNotificationTemplateDefinitions) {
    for (const channel of externalNotificationChannels) {
      const existingTemplate = await prisma.notificationTemplate.findFirst({
        where: {
          companyId: null,
          key: definition.key,
          channel,
          deletedAt: null,
        },
      });
      const templateData = {
        name: definition.name,
        description: definition.description,
        audienceScope: definition.audienceScope,
        subject: definition.subject,
        body: definition.body,
        isSystem: true,
        isActive: true,
        deletedAt: null,
      };
      if (existingTemplate) {
        await prisma.notificationTemplate.update({
          where: { id: existingTemplate.id },
          data: templateData,
        });
      } else {
        await prisma.notificationTemplate.create({
          data: {
            companyId: null,
            key: definition.key,
            channel,
            ...templateData,
          },
        });
      }
    }
  }

  for (const [key, channel, name, subject, body] of portalAccessTemplateDefinitions) {
    const existingTemplate = await prisma.notificationTemplate.findFirst({
      where: { companyId: null, key, channel, deletedAt: null },
    });
    const data = {
      name,
      description: "Customer-safe single-use portal activation instructions.",
      audienceScope: "CLIENT_PORTAL" as const,
      subject,
      body,
      isSystem: true,
      isActive: true,
      deletedAt: null,
    };
    if (existingTemplate) {
      await prisma.notificationTemplate.update({ where: { id: existingTemplate.id }, data });
    } else {
      await prisma.notificationTemplate.create({ data: { companyId: null, key, channel, ...data } });
    }
  }

  for (const [key, channel, name, subject, body] of clientShareTemplateDefinitions) {
    const existingTemplate = await prisma.notificationTemplate.findFirst({
      where: { companyId: null, key, channel, deletedAt: null },
    });
    const data = {
      name,
      description: "Customer-safe manual share delivery.",
      audienceScope: "CLIENT_PORTAL" as const,
      subject,
      body,
      isSystem: true,
      isActive: true,
      deletedAt: null,
    };
    if (existingTemplate) {
      await prisma.notificationTemplate.update({ where: { id: existingTemplate.id }, data });
    } else {
      await prisma.notificationTemplate.create({ data: { companyId: null, key, channel, ...data } });
    }
  }

  const platformRoles = new Map<RoleCode, { id: string }>();
  for (const roleCode of platformRoleCodes) {
    const role = await upsertRole({ code: roleCode, companyId: null, permissionByKey });
    platformRoles.set(roleCode, role);
  }

  const legacySuperAdminRoles = await prisma.role.findMany({
    where: { code: "SUPER_ADMIN" },
  });
  for (const role of legacySuperAdminRoles) {
    await prisma.role.update({
      where: { id: role.id },
      data: {
        name: roleNames.SUPER_ADMIN,
        rolepermission: { deleteMany: {} },
      },
    });
  }

  const companyRoles = new Map<RoleCode, { id: string }>();
  for (const roleCode of companyRoleCodes) {
    const role = await upsertRole({ code: roleCode, companyId: company.id, permissionByKey });
    companyRoles.set(roleCode, role);
  }

  const password = process.env.SEED_ADMIN_PASSWORD ?? "Admin123";
  const passwordHash = await bcrypt.hash(password, 12);

  const platformEmail =
    process.env.SEED_PLATFORM_EMAIL?.toLowerCase() ??
    "platform@freightcontrol.com";
  const platformOwner = await prisma.user.upsert({
    where: { email: platformEmail },
    update: {
      name: "Platform Owner",
      companyId: null,
      scope: "PLATFORM",
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      name: "Platform Owner",
      email: platformEmail,
      companyId: null,
      scope: "PLATFORM",
      passwordHash,
      status: "ACTIVE",
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: platformOwner.id } });
  await prisma.userRole.create({
    data: {
      userId: platformOwner.id,
      roleId: platformRoles.get("PLATFORM_OWNER")!.id,
    },
  });

  const companyAdminEmail =
    process.env.SEED_COMPANY_ADMIN_EMAIL?.toLowerCase() ??
    process.env.SEED_ADMIN_EMAIL?.toLowerCase() ??
    "admin@freightcontrol.com";
  const companyAdmin = await prisma.user.upsert({
    where: { email: companyAdminEmail },
    update: {
      name: "Company Admin",
      companyId: company.id,
      scope: "COMPANY",
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      name: "Company Admin",
      email: companyAdminEmail,
      companyId: company.id,
      scope: "COMPANY",
      passwordHash,
      status: "ACTIVE",
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: companyAdmin.id } });
  await prisma.userRole.create({
    data: {
      userId: companyAdmin.id,
      roleId: companyRoles.get("COMPANY_ADMIN")!.id,
    },
  });
  await prisma.userbranchmembership.upsert({
    where: { userId_branchId: { userId: companyAdmin.id, branchId: headOffice.id } },
    update: { isDefault: true, updatedAt: new Date() },
    create: {
      id: crypto.randomUUID(),
      userId: companyAdmin.id,
      branchId: headOffice.id,
      isDefault: true,
      updatedAt: new Date(),
    },
  });

  const demoRoleUsers = [
    ["operations@freightcontrol.com", "Operations Manager", "OPERATIONS_MANAGER"],
    ["documentation@freightcontrol.com", "Documentation Officer", "DOCUMENTATION_OFFICER"],
    ["accounts@freightcontrol.com", "Accounts Officer", "ACCOUNTS_OFFICER"],
    ["sales@freightcontrol.com", "Sales Executive", "SALES_EXECUTIVE"],
  ] as const;

  for (const [email, name, roleCode] of demoRoleUsers) {
    const roleUser = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        companyId: company.id,
        scope: "COMPANY",
        passwordHash,
        status: "ACTIVE",
        deletedAt: null,
      },
      create: {
        name,
        email,
        companyId: company.id,
        scope: "COMPANY",
        passwordHash,
        status: "ACTIVE",
      },
    });
    await prisma.userRole.deleteMany({ where: { userId: roleUser.id } });
    await prisma.userRole.create({
      data: {
        userId: roleUser.id,
        roleId: companyRoles.get(roleCode)!.id,
      },
    });
    await prisma.userbranchmembership.upsert({
      where: { userId_branchId: { userId: roleUser.id, branchId: headOffice.id } },
      update: { isDefault: true, updatedAt: new Date() },
      create: {
        id: crypto.randomUUID(),
        userId: roleUser.id,
        branchId: headOffice.id,
        isDefault: true,
        updatedAt: new Date(),
      },
    });
  }

  const demoCustomer =
    (await prisma.customer.findFirst({
      where: { companyId: company.id, code: "DEMO-CLIENT" },
    })) ??
    (await prisma.customer.create({
      data: {
        companyId: company.id,
        name: "Demo Client Company",
        code: "DEMO-CLIENT",
        email: "client@example.com",
        phone: "+8801700000001",
        status: "ACTIVE",
      },
    }));

  const demoClientPassword = process.env.SEED_CLIENT_PASSWORD ?? "Client@2026";
  const demoClientPasswordHash = await bcrypt.hash(demoClientPassword, 12);
  const year = new Date().getFullYear();
  const demoClientCode = `DFC-CL-${year}-0001`;
  const existingDemoAccount = await prisma.clientPortalAccount.findFirst({
    where: { companyId: company.id, displayClientCode: demoClientCode },
  });
  if (existingDemoAccount) {
    await prisma.clientPortalAccount.update({
      where: { id: existingDemoAccount.id },
      data: {
        customerId: demoCustomer.id,
        clientCode: demoClientCode,
        email: demoCustomer.email,
        phone: demoCustomer.phone,
        passwordHash: demoClientPasswordHash,
        status: "ACTIVE",
        mustChangePassword: true,
        deletedAt: null,
        createdById: companyAdmin.id,
      },
    });
  } else {
    await prisma.clientPortalAccount.create({
      data: {
        companyId: company.id,
        customerId: demoCustomer.id,
        clientCode: demoClientCode,
        displayClientCode: demoClientCode,
        email: demoCustomer.email,
        phone: demoCustomer.phone,
        passwordHash: demoClientPasswordHash,
        status: "ACTIVE",
        mustChangePassword: true,
        createdById: companyAdmin.id,
      },
    });
  }
  const existingClientSequence = await prisma.clientPortalSequence.findUnique({
    where: { companyId_year: { companyId: company.id, year } },
  });
  if (!existingClientSequence) {
    await prisma.clientPortalSequence.create({
      data: { companyId: company.id, year, currentSequence: 1 },
    });
  }

  // --- Demo/test fixtures (idempotent) ---
  const clientAccount = await prisma.clientPortalAccount.findFirst({
    where: { companyId: company.id, displayClientCode: demoClientCode },
  });

  // 1) Shipment request owned by demo client
  const demoRequestNo = `REQ-${year}-DEMO-0001`;
  let demoRequest = await prisma.shipmentRequest.findFirst({ where: { companyId: company.id, requestNo: demoRequestNo } });
  if (demoRequest) {
    await prisma.shipmentRequest.update({ where: { id: demoRequest.id }, data: { customerId: demoCustomer.id, clientPortalAccountId: clientAccount?.id ?? null, customerReference: 'Demo request', deletedAt: null } });
    } else {
    demoRequest = await prisma.shipmentRequest.create({
      data: {
        companyId: company.id,
        branchId: headOffice.id,
        customerId: demoCustomer.id,
        requestNo: demoRequestNo,
        clientPortalAccountId: clientAccount?.id ?? null,
        customerReference: 'Demo request',
        createdById: companyAdmin.id,
        status: 'SUBMITTED',
        shipmentType: 'IMPORT',
        transportMode: 'SEA',
        serviceScope: 'PORT_TO_PORT',
        originCountry: 'China',
        originPort: 'Shanghai',
        destinationCountry: 'Bangladesh',
        destinationPort: 'Chattogram',
        cargoDescription: 'General cargo',
      },
    });
  }

  // 2) Quotation linked to request
  const demoQuoteNo = `QT-${year}-0001`;
  let demoQuotation = await prisma.quotation.findFirst({ where: { companyId: company.id, quoteNo: demoQuoteNo } });
  if (demoQuotation) {
    await prisma.quotation.update({ where: { id: demoQuotation.id }, data: { customerId: demoCustomer.id, shipmentRequestId: demoRequest.id, status: 'SENT', deletedAt: null } });
  } else {
    demoQuotation = await prisma.quotation.create({
      data: {
        companyId: company.id,
        branchId: headOffice.id,
        customerId: demoCustomer.id,
        shipmentRequestId: demoRequest.id,
        quoteNo: demoQuoteNo,
        status: 'SENT',
        createdById: companyAdmin.id,
      },
    });
  }

  // 3) Shipment converted from request and visible in portal (but without internal costing details)
  const demoJobNo = `JOB-${year}-0001`;
  let demoShipment = await prisma.shipmentJob.findFirst({ where: { companyId: company.id, jobNo: demoJobNo } });
  if (demoShipment) {
    await prisma.shipmentJob.update({ where: { id: demoShipment.id }, data: { customer: { connect: { id: demoCustomer.id } }, currentStatus: 'In progress', deletedAt: null } });
  } else {
    demoShipment = await prisma.shipmentJob.create({
      data: {
        companyId: company.id,
        branchId: headOffice.id,
        customerId: demoCustomer.id,
        jobNo: demoJobNo,
        shipmentType: 'IMPORT',
        transportMode: 'SEA',
        currentStatus: 'In progress',
        createdById: companyAdmin.id,
        assignedToId: companyAdmin.id,
        loadType: 'FCL',
        originCountry: 'China',
        originPort: 'Shanghai',
        destinationCountry: 'Bangladesh',
        destinationPort: 'Chattogram',
        cargoDescription: 'General cargo',
      },
    });
  }
  await prisma.shipmentRequest.update({
    where: { id: demoRequest.id },
    data: { convertedShipmentJobId: demoShipment.id },
  });

  // 4) Invoice linked to demo quotation/shipment
  const demoInvoiceNo = `INV-${year}-0001`;
  let demoInvoice = await prisma.invoice.findFirst({ where: { companyId: company.id, invoiceNo: demoInvoiceNo } });
  if (demoInvoice) {
    await prisma.invoice.update({ where: { id: demoInvoice.id }, data: { company: { connect: { id: company.id } }, branch: { connect: { id: headOffice.id } }, customer: { connect: { id: demoCustomer.id } }, quotation: { connect: { id: demoQuotation.id } }, shipmentjob: { connect: { id: demoShipment.id } }, user: { connect: { id: companyAdmin.id } }, dueAmount: 1000, currency: 'BDT', status: 'SENT', deletedAt: null } });
  } else {
    demoInvoice = await prisma.invoice.create({
      data: {
        company: { connect: { id: company.id } },
        branch: { connect: { id: headOffice.id } },
        customer: { connect: { id: demoCustomer.id } },
        quotation: { connect: { id: demoQuotation.id } },
        shipmentjob: { connect: { id: demoShipment.id } },
        invoiceNo: demoInvoiceNo,
        dueAmount: 1000,
        currency: 'BDT',
        status: 'SENT',
        user: { connect: { id: companyAdmin.id } },
        invoiceDate: new Date(),
      },
    });
  }

  // 5) Portal notification for unread KPI
  const existingNotification = await prisma.notification.findFirst({ where: { companyId: company.id, clientPortalAccountId: clientAccount?.id ?? null, title: 'Demo notification for portal' } });
  if (!existingNotification && clientAccount?.id) {
    await prisma.notification.create({
      data: {
        companyId: company.id,
        clientPortalAccountId: clientAccount.id,
        scope: 'CLIENT_PORTAL',
        type: 'INFO',
        title: 'Demo notification for portal',
        message: 'This is a seeded demo notification (unread).',
        linkUrl: `/portal/${company.portalSlug}/requests/${demoRequest.id}`,
      },
    });
  }

  // Ensure there's at least one required document checklist item for Commercial Invoice (already seeded earlier),
  // and leave the demo shipment without documents so 'Missing documents' KPI is non-zero for the portal account.
  // (No further action required here since checklist items are created above.)


  await prisma.auditLog.createMany({
    data: [
      {
        companyId: null,
        actorId: platformOwner.id,
        action: "PLATFORM_SEED",
        entityType: "User",
        entityId: platformOwner.id,
        metadata: JSON.stringify({
          email: platformOwner.email,
          roles: ["PLATFORM_OWNER"],
        }),
      },
      {
        companyId: company.id,
        actorId: companyAdmin.id,
        action: "COMPANY_SEED",
        entityType: "User",
        entityId: companyAdmin.id,
        metadata: JSON.stringify({
          email: companyAdmin.email,
          roles: ["COMPANY_ADMIN"],
        }),
      },
    ],
  });

  await seedWorkflowTemplates();


  console.log(`Seeded platform owner: ${platformOwner.email}`);
  console.log(`Seeded company: ${company.name}`);
  console.log(`Company admin login: ${companyAdmin.email}`);
  console.log(`Client portal: /portal/${company.portalSlug}/login`);
  console.log(`Demo client ID: ${demoClientCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

async function seedWorkflowTemplates() {
  const count = await prisma.workflowTemplate.count({ where: { companyId: null } });
  if (count >= 96) {
    console.log("Workflow templates already seeded. Skipping workflow template seeding...");
    return;
  }
  console.log("Seeding new workflow engine templates...");

  const modes: ("SEA" | "AIR" | "LAND")[] = ["SEA", "AIR", "LAND"];
  const directions: ("IMPORT" | "EXPORT")[] = ["IMPORT", "EXPORT"];
  const loadTypes: ("FCL" | "LCL" | "AIR_CARGO" | "TRUCK")[] = ["FCL", "LCL", "AIR_CARGO", "TRUCK"];
  const serviceScopes: ("PORT_TO_PORT" | "DOOR_TO_PORT" | "PORT_TO_DOOR" | "DOOR_TO_DOOR")[] = [
    "PORT_TO_PORT",
    "DOOR_TO_PORT",
    "PORT_TO_DOOR",
    "DOOR_TO_DOOR",
  ];

  for (const mode of modes) {
    for (const direction of directions) {
      for (const loadType of loadTypes) {
        for (const serviceScope of serviceScopes) {
          const templateName = `${mode} ${direction} ${loadType} (${serviceScope.replace(/_/g, " ")})`;

          let template = await prisma.workflowTemplate.findFirst({
            where: { companyId: null, mode, direction, loadType, serviceScope },
          });

          if (!template) {
            template = await prisma.workflowTemplate.create({
              data: {
                companyId: null,
                name: templateName,
                mode,
                direction,
                loadType,
                serviceScope,
                isActive: true,
              },
            });
          }

          const stagesDef: { code: string; name: string; sortOrder: number; description?: string }[] = [];
          let order = 10;

          const addStage = (code: string, name: string, desc?: string) => {
            stagesDef.push({ code, name, sortOrder: order, description: desc });
            order += 10;
          };

          addStage("QUERY_RECEIVED", "Query Received", "Initial customer query received");
          addStage("RATE_SOURCING", "Rate Sourcing", "Sourcing rates from carriers/vendors");
          addStage("QUOTATION_SENT", "Quotation Sent", "Quotation sent to the customer");
          addStage("QUOTATION_ACCEPTED", "Quotation Accepted", "Customer accepted the quotation");
          addStage("JOB_FILE_OPENED", "Job File Opened", "Internal job file opened for shipment");
          addStage("BOOKING_REQUESTED", "Booking Requested", "Carrier booking requested");
          addStage("BOOKING_CONFIRMED", "Booking Confirmed", "Carrier booking confirmed with references");

          if (serviceScope === "DOOR_TO_PORT" || serviceScope === "DOOR_TO_DOOR") {
            addStage("CARGO_PICKUP_SCHEDULED", "Cargo Pickup Scheduled", "Pickup from shipper scheduled");
          }

          addStage("CARGO_RECEIVED", "Cargo Received / Handover", "Cargo received at port or warehouse");

          if (direction === "EXPORT") {
            addStage("EXPORT_CUSTOMS_PROCESSING", "Export Customs Processing", "Origin customs formalities started");
            addStage("EXPORT_CUSTOMS_CLEARED", "Export Customs Cleared", "Origin customs cleared");
          }

          if (mode === "SEA" || mode === "AIR") {
            addStage("SI_SUBMITTED", "SI Submitted", "Shipping Instruction submitted to carrier");
          }

          addStage("DRAFT_BL_AWB_CREATED", "Draft BL/AWB Created", "Draft Bill of Lading or AWB prepared");
          addStage("DRAFT_SENT_TO_CUSTOMER", "Draft Sent to Customer", "Draft sent to customer for verification");
          addStage("CUSTOMER_APPROVED_DRAFT", "Customer Approved Draft", "Customer approved draft document");
          addStage("FINAL_BL_AWB_LOCKED", "Final BL/AWB Locked", "Final original document locked and released");
          addStage("MANIFEST_PREPARED", "Manifest Prepared", "Manifest prepared for customs/carrier");
          addStage("DEPARTED", "Departed", "Vessel or flight departed origin");
          addStage("IN_TRANSIT", "In Transit", "Shipment is currently in transit");
          addStage("PRE_ALERT_SENT", "Pre-alert Sent", "Pre-alert document sent to destination agent");
          addStage("ARRIVED_AT_DESTINATION", "Arrived at Destination", "Shipment arrived at destination port/airport");

          if (direction === "IMPORT") {
            addStage("IMPORT_CLEARANCE", "Import Customs Clearance", "Customs clearance at destination started");
          }

          addStage("DELIVERY_ORDER_RELEASE", "Delivery Order / Release", "Delivery order released to consignee");

          if (serviceScope === "PORT_TO_DOOR" || serviceScope === "DOOR_TO_DOOR") {
            addStage("OUT_FOR_DELIVERY", "Out for Delivery", "Consignment out for final delivery");
          }

          addStage("DELIVERED", "Delivered", "Delivered to consignee and POD uploaded");
          addStage("INVOICE_ISSUED", "Invoice Issued", "Customer invoices generated");
          addStage("PAYMENT_RECEIVED", "Payment Received", "Full customer payment received");
          addStage("VENDOR_BILLS_CLOSED", "Vendor Bills Closed", "All vendor bills received and settled");
          addStage("OPERATIONALLY_CLOSED", "Operationally Closed", "Operations workflow completed");
          addStage("FINANCIALLY_CLOSED", "Financially Closed", "Financial audits completed");
          addStage("JOB_CLOSED", "Job Closed / Archived", "Shipment folder closed and archived");

          for (const stageDef of stagesDef) {
            let stageTemplate = await prisma.workflowStageTemplate.findFirst({
              where: { workflowTemplateId: template.id, stageCode: stageDef.code },
            });

            if (!stageTemplate) {
              stageTemplate = await prisma.workflowStageTemplate.create({
                data: {
                  workflowTemplateId: template.id,
                  stageCode: stageDef.code,
                  stageName: stageDef.name,
                  sortOrder: stageDef.sortOrder,
                  description: stageDef.description,
                },
              });
            } else {
              await prisma.workflowStageTemplate.update({
                where: { id: stageTemplate.id },
                data: {
                  stageName: stageDef.name,
                  sortOrder: stageDef.sortOrder,
                  description: stageDef.description,
                },
              });
            }

            await prisma.workflowStageRequirement.deleteMany({
              where: { workflowStageTemplateId: stageTemplate.id },
            });

            const reqs: { type: "FIELD" | "DOCUMENT" | "APPROVAL" | "PREVIOUS_STAGE" | "FINANCIAL"; target: string; description: string }[] = [];

            if (stageDef.code === "BOOKING_CONFIRMED") {
              reqs.push({ type: "FIELD", target: "bookingNo", description: "Carrier Booking Number is required." });
              reqs.push({ type: "FIELD", target: "carrierName", description: "Carrier Name is required." });
              reqs.push({ type: "FIELD", target: "etd", description: "Estimated Time of Departure (ETD) is required." });
              reqs.push({ type: "FIELD", target: "eta", description: "Estimated Time of Arrival (ETA) is required." });
            }

            if (stageDef.code === "SI_SUBMITTED") {
              reqs.push({ type: "PREVIOUS_STAGE", target: "BOOKING_CONFIRMED", description: "Carrier booking must be confirmed first." });
              reqs.push({ type: "FIELD", target: "shipperName", description: "Shipper details are required." });
              reqs.push({ type: "FIELD", target: "consigneeName", description: "Consignee details are required." });
              reqs.push({ type: "FIELD", target: "cargoDescription", description: "Cargo description details are required." });
            }

            if (stageDef.code === "DRAFT_BL_AWB_CREATED") {
              reqs.push({ type: "PREVIOUS_STAGE", target: "SI_SUBMITTED", description: "Shipping Instructions must be submitted first." });
            }

            if (stageDef.code === "FINAL_BL_AWB_LOCKED") {
              reqs.push({ type: "APPROVAL", target: "CUSTOMER_APPROVED_DRAFT", description: "Customer must approve the draft BL/AWB." });
            }

            if (stageDef.code === "PRE_ALERT_SENT") {
              reqs.push({ type: "PREVIOUS_STAGE", target: "FINAL_BL_AWB_LOCKED", description: "Final BL/AWB must be locked first." });
              reqs.push({ type: "FIELD", target: "destinationAgentId", description: "Destination agent must be assigned." });
            }

            if (stageDef.code === "IMPORT_CLEARANCE") {
              reqs.push({ type: "DOCUMENT", target: "CUSTOMS_RELEASE", description: "Customs Release / Bill of Entry must be received or verified." });
            }

            if (stageDef.code === "EXPORT_CUSTOMS_CLEARED") {
              reqs.push({ type: "DOCUMENT", target: "CUSTOMS_RELEASE", description: "Customs Release / Export Declaration must be received or verified." });
            }

            if (stageDef.code === "DELIVERY_ORDER_RELEASE") {
              reqs.push({ type: "DOCUMENT", target: "DELIVERY_ORDER", description: "Delivery Order must be received or verified." });
            }

            if (stageDef.code === "OUT_FOR_DELIVERY") {
              reqs.push({ type: "DOCUMENT", target: "GATE_PASS", description: "Gate Pass must be received or verified." });
            }

            if (stageDef.code === "DELIVERED") {
              reqs.push({ type: "PREVIOUS_STAGE", target: "DELIVERY_ORDER_RELEASE", description: "Delivery order must be released first." });
              reqs.push({ type: "DOCUMENT", target: "POD", description: "Proof of Delivery (POD) must be verified." });
            }

            if (stageDef.code === "FINANCIALLY_CLOSED") {
              reqs.push({ type: "FINANCIAL", target: "INVOICES_PAID", description: "All customer invoices must be fully paid." });
              reqs.push({ type: "FINANCIAL", target: "VENDOR_BILLS_PAID", description: "All vendor bills must be settled." });
            }

            if (reqs.length > 0) {
              await prisma.workflowStageRequirement.createMany({
                data: reqs.map(r => ({
                  workflowStageTemplateId: stageTemplate.id,
                  type: r.type,
                  target: r.target,
                  description: r.description,
                })),
              });
            }
          }
        }
      }
    }
  }

  await prisma.workflowStageTemplate.deleteMany({
    where: { stageCode: "CARGO_RELEASED" },
  });
}

