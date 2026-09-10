"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  type ActionState,
  audit,
  getFormData,
  getString,
  getStringArray,
  successState,
  validationError,
} from "@/lib/actions/helpers";
import { requirePlatformPermission } from "@/lib/permissions/rbac";
import { seedDefaultChartOfAccounts } from "@/lib/accounting/seed-chart-of-accounts";
import { hashPassword } from "@/lib/auth/password";
import { generateClientPortalPassword } from "@/lib/client-portal/credentials";
import {
  COMPANY_ROLE_CODES,
  COMPANY_ROLE_NAMES,
  COMPANY_ROLE_PERMISSIONS,
} from "@/lib/permissions/company-role-permissions";

const moduleKeys = [
  "SHIPMENTS",
  "DOCUMENTS",
  "QUOTATIONS",
  "COSTING",
  "BILLING",
  "REPORTS",
  "CLIENT_PORTAL",
  "WHATSAPP_ALERTS",
  "API_ACCESS",
] as const;

const platformCompanySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Company name is required."),
  legalName: z.string().trim().optional().transform((value) => value || null),
  email: z.string().trim().optional().transform((value) => value || null).pipe(z.string().email("Enter a valid email.").nullable()),
  phone: z.string().trim().optional().transform((value) => value || null),
  address: z.string().trim().optional().transform((value) => value || null),
  country: z.string().trim().optional().transform((value) => value || null),
  baseCurrency: z.enum(["BDT", "USD", "EUR", "GBP", "CNY", "INR", "AED", "RUB", "OTHER"]),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  planType: z.enum(["TRIAL", "MONTHLY", "YEARLY", "LIFETIME_CLOUD", "SELF_HOSTED"]),
  deploymentType: z.enum(["CLOUD", "SELF_HOSTED"]),
  subscriptionStatus: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "SUSPENDED", "EXPIRED", "CANCELLED"]),
  trialEndsAt: z.preprocess((value) => (value === "" ? null : value), z.coerce.date().nullable()),
  subscriptionEndsAt: z.preprocess((value) => (value === "" ? null : value), z.coerce.date().nullable()),
  maxUsers: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().int().positive("Must be greater than zero.").nullable()),
  storageLimitMB: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().int().positive("Must be greater than zero.").nullable()),
  portalSlug: z.string().trim().toLowerCase().optional().transform((value) => value || null).pipe(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.").nullable()),
  portalDisplayName: z.string().trim().optional().transform((value) => value || null),
  portalCodePrefix: z.string().trim().toUpperCase().optional().transform((value) => value || null).pipe(z.string().regex(/^[A-Z0-9]{2,6}$/, "Use 2-6 uppercase letters or numbers.").nullable()),
  portalEnabled: z.boolean(),
  enabledModules: z.array(z.enum(moduleKeys)),
}).superRefine((data, context) => {
  if (data.portalEnabled && !data.portalSlug) {
    context.addIssue({ code: "custom", path: ["portalSlug"], message: "Portal slug is required when the portal is enabled." });
  }
  if (data.portalEnabled && !data.portalCodePrefix) {
    context.addIssue({ code: "custom", path: ["portalCodePrefix"], message: "Portal code prefix is required when the portal is enabled." });
  }
});

function revalidatePlatformPaths() {
  revalidatePath("/platform");
  revalidatePath("/platform/companies");
  revalidatePath("/platform/subscriptions");
  revalidatePath("/platform/modules");
}

export async function savePlatformCompany(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const user = await requirePlatformPermission(
    id ? "platform:companies:update" : "platform:companies:create",
  );

  const parsed = platformCompanySchema.safeParse({
    id,
    name: getString(formData, "name"),
    legalName: getString(formData, "legalName"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    address: getString(formData, "address"),
    country: getString(formData, "country"),
    baseCurrency: getString(formData, "baseCurrency") || "BDT",
    status: getString(formData, "status") || "ACTIVE",
    planType: getString(formData, "planType") || "TRIAL",
    deploymentType: getString(formData, "deploymentType") || "CLOUD",
    subscriptionStatus: getString(formData, "subscriptionStatus") || "TRIAL",
    trialEndsAt: getString(formData, "trialEndsAt"),
    subscriptionEndsAt: getString(formData, "subscriptionEndsAt"),
    maxUsers: getString(formData, "maxUsers"),
    storageLimitMB: getString(formData, "storageLimitMB"),
    portalSlug: getString(formData, "portalSlug"),
    portalDisplayName: getString(formData, "portalDisplayName"),
    portalCodePrefix: getString(formData, "portalCodePrefix"),
    portalEnabled: getString(formData, "portalEnabled") === "true",
    enabledModules: getStringArray(formData, "enabledModules"),
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted platform company fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { enabledModules, id: parsedId, ...data } = parsed.data;
  const previous = parsedId
    ? await prisma.company.findUnique({ where: { id: parsedId } })
    : null;

  if (parsedId && !previous) {
    return validationError("Company was not found.");
  }

  let company;
  const now = new Date();
  try {
    company = await prisma.$transaction(async (tx) => {
    const saved = parsedId
      ? await tx.company.update({
          where: { id: parsedId },
          data: { ...data, updatedAt: now },
        })
      : await tx.company.create({
          data: { id: randomUUID(), ...data, updatedAt: now },
        });

    await tx.companysubscription.upsert({
      where: { companyId: saved.id },
      update: {
        planType: data.planType,
        deploymentType: data.deploymentType,
        status: data.subscriptionStatus,
        trialEndsAt: data.trialEndsAt,
        expiresAt: data.subscriptionEndsAt,
        maxUsers: data.maxUsers,
        storageLimitMB: data.storageLimitMB,
        updatedAt: now,
      },
      create: {
        id: randomUUID(),
        companyId: saved.id,
        planType: data.planType,
        deploymentType: data.deploymentType,
        status: data.subscriptionStatus,
        trialEndsAt: data.trialEndsAt,
        expiresAt: data.subscriptionEndsAt,
        maxUsers: data.maxUsers,
        storageLimitMB: data.storageLimitMB,
        updatedAt: now,
      },
    });

    for (const moduleKey of moduleKeys) {
      await tx.companymoduleaccess.upsert({
        where: { companyId_moduleKey: { companyId: saved.id, moduleKey } },
        update: { isEnabled: enabledModules.includes(moduleKey), updatedAt: now },
        create: {
          id: randomUUID(),
          companyId: saved.id,
          moduleKey,
          isEnabled: enabledModules.includes(moduleKey),
          updatedAt: now,
        },
      });
    }

      return saved;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationError("This portal slug is already in use.", {
        portalSlug: ["Choose a unique portal slug."],
      });
    }
    throw error;
  }

  let provisioning: { adminEmail: string; adminPassword: string } | null = null;
  if (!parsedId) {
    try {
      await seedDefaultChartOfAccounts(company.id);
    } catch (chartOfAccountsError) {
      console.error("Failed to seed chart of accounts", chartOfAccountsError);
    }
    try {
      provisioning = await provisionDefaultCompanyAccess(company.id, company.email);
    } catch (provisioningError) {
      console.error("Failed to provision default roles/branch/admin for new company", provisioningError);
    }
  }

  await audit({
    companyId: company.id,
    actorId: user.id,
    action: parsedId ? "PLATFORM_COMPANY_UPDATED" : "PLATFORM_COMPANY_CREATED",
    entityType: "Company",
    entityId: company.id,
    metadata: {
      name: company.name,
      planType: company.planType,
      subscriptionStatus: company.subscriptionStatus,
    },
  });

  if (previous && previous.status !== company.status) {
    await audit({
      companyId: company.id,
      actorId: user.id,
      action: "PLATFORM_COMPANY_STATUS_CHANGED",
      entityType: "Company",
      entityId: company.id,
      metadata: { from: previous.status, to: company.status },
    });
  }

  revalidatePlatformPaths();
  if (parsedId) return successState("Company updated.");
  if (!provisioning) {
    return successState(
      "Company created, but setting up its default roles/branch/admin login failed -- check server logs and provision manually before handing this off.",
    );
  }
  return successState(
    `Company created. First login -- Email: ${provisioning.adminEmail} / Temporary password: ${provisioning.adminPassword}. This password is shown once only -- copy it now and share it with the company's admin yourself.`,
  );
}

/**
 * Everything a brand-new company needs before anyone can actually sign in
 * and use it: a default branch, its own set of company-scoped roles (with
 * the same permission grants every other company gets -- see
 * lib/permissions/company-role-permissions.ts, shared with prisma/seed.ts),
 * and a first Company Admin user. Without this, a platform-created company
 * is an unusable empty shell -- there is no self-service signup, so this is
 * the only path a new tenant ever gets provisioned through.
 */
async function provisionDefaultCompanyAccess(companyId: string, contactEmail: string | null) {
  const now = new Date();

  const branch = await prisma.branch.create({
    data: {
      id: randomUUID(),
      companyId,
      code: "HEAD_OFFICE",
      name: "Head Office",
      isActive: true,
      updatedAt: now,
    },
  });

  const allPermissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permissionIdByKey = new Map(allPermissions.map((permission) => [permission.key, permission.id]));

  const roleIdByCode = new Map<string, string>();
  for (const code of COMPANY_ROLE_CODES) {
    const role = await prisma.role.create({
      data: {
        id: randomUUID(),
        companyId,
        code,
        name: COMPANY_ROLE_NAMES[code],
        isSystem: true,
        updatedAt: now,
      },
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

  // The company's own contact email doubles as its first admin's login,
  // matching how the demo fixtures are set up -- unless it's blank or
  // already registered to another user, in which case fall back to a
  // generated address the platform admin can change from Users afterward.
  let adminEmail = contactEmail?.trim().toLowerCase() || "";
  if (adminEmail) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) adminEmail = "";
  }
  if (!adminEmail) {
    adminEmail = `admin+${randomUUID().slice(0, 8)}@placeholder.freito.local`;
  }

  const adminPassword = generateClientPortalPassword();
  const passwordHash = await hashPassword(adminPassword);

  const adminUser = await prisma.user.create({
    data: {
      id: randomUUID(),
      companyId,
      name: "Company Admin",
      email: adminEmail,
      passwordHash,
      status: "ACTIVE",
      scope: "COMPANY",
      updatedAt: now,
    },
  });

  await prisma.userrole.create({
    data: { id: randomUUID(), userId: adminUser.id, roleId: roleIdByCode.get("COMPANY_ADMIN")! },
  });

  await prisma.userbranchmembership.create({
    data: { id: randomUUID(), userId: adminUser.id, branchId: branch.id, isDefault: true, updatedAt: now },
  });

  return { adminEmail, adminPassword };
}

export async function initializeCompanyAccounting(formData: FormData) {
  const user = await requirePlatformPermission("platform:companies:update");
  const companyId = getString(formData, "id");
  if (!companyId) return;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return;

  await seedDefaultChartOfAccounts(companyId);

  await audit({
    companyId,
    actorId: user.id,
    action: "PLATFORM_COMPANY_ACCOUNTING_INITIALIZED",
    entityType: "Company",
    entityId: companyId,
    metadata: { name: company.name },
  });

  revalidatePlatformPaths();
}

/**
 * Grants a user (from any company) view-only, audit-mode access to switch
 * into `companyId` -- the row `getAuditScopedCompanyId` re-validates on every
 * report read. Granting is platform-only: the target company never controls
 * who can audit it, and the grantee's own company never controls who can
 * audit *other* companies. A no-op if the user already belongs to that
 * company (their home company never needs a separate grant) or the grant
 * already exists.
 */
export async function grantCompanySwitchAccess(formData: FormData) {
  const user = await requirePlatformPermission("platform:companies:update");
  const companyId = getString(formData, "companyId");
  const userId = getString(formData, "userId");
  if (!companyId || !userId) return;

  const [company, targetUser] = await Promise.all([
    prisma.company.findFirst({ where: { id: companyId, deletedAt: null } }),
    prisma.user.findFirst({ where: { id: userId, deletedAt: null } }),
  ]);
  if (!company || !targetUser || targetUser.companyId === companyId) return;

  await prisma.usercompanyaccess.upsert({
    where: { userId_companyId: { userId, companyId } },
    update: {},
    create: { id: randomUUID(), userId, companyId, updatedAt: new Date() },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "PLATFORM_COMPANY_SWITCH_ACCESS_GRANTED",
    entityType: "Company",
    entityId: companyId,
    metadata: { grantedToUserId: userId, grantedToEmail: targetUser.email },
  });

  revalidatePath(`/platform/companies/${companyId}`);
}

export async function revokeCompanySwitchAccess(formData: FormData) {
  const user = await requirePlatformPermission("platform:companies:update");
  const id = getString(formData, "id");
  if (!id) return;

  const grant = await prisma.usercompanyaccess.findUnique({ where: { id } });
  if (!grant) return;

  await prisma.usercompanyaccess.delete({ where: { id } });

  await audit({
    companyId: grant.companyId,
    actorId: user.id,
    action: "PLATFORM_COMPANY_SWITCH_ACCESS_REVOKED",
    entityType: "Company",
    entityId: grant.companyId,
    metadata: { revokedFromUserId: grant.userId },
  });

  revalidatePath(`/platform/companies/${grant.companyId}`);
}

export async function suspendPlatformCompany(formData: FormData) {
  const user = await requirePlatformPermission("platform:companies:suspend");
  const id = getString(formData, "id");
  const company = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, name: true, status: true },
  });
  if (!company) return;

  const now = new Date();
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: {
      status: company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      subscriptionStatus: company.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      updatedAt: now,
    },
  });

  await prisma.companysubscription.upsert({
    where: { companyId: updated.id },
    update: { status: updated.subscriptionStatus, updatedAt: now },
    create: {
      id: randomUUID(),
      companyId: updated.id,
      planType: updated.planType,
      deploymentType: updated.deploymentType,
      status: updated.subscriptionStatus,
      updatedAt: now,
    },
  });

  await audit({
    companyId: updated.id,
    actorId: user.id,
    action: "PLATFORM_COMPANY_STATUS_CHANGED",
    entityType: "Company",
    entityId: updated.id,
    metadata: { from: company.status, to: updated.status },
  });

  revalidatePlatformPaths();
}
