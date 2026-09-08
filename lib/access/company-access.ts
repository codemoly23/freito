import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

export type ModuleKey =
  | "SHIPMENTS"
  | "DOCUMENTS"
  | "QUOTATIONS"
  | "COSTING"
  | "BILLING"
  | "REPORTS"
  | "TASKS"
  | "SHIPMENT_OPERATIONS"
  | "CLIENT_PORTAL"
  | "WHATSAPP_ALERTS"
  | "API_ACCESS";

type CompanyAccessStatus = {
  allowed: boolean;
  reason?: "COMPANY_INACTIVE" | "SUBSCRIPTION_INACTIVE" | "TRIAL_EXPIRED";
};

export async function getCompanyAccessStatus(
  companyId: string | null | undefined,
): Promise<CompanyAccessStatus> {
  if (!companyId) return { allowed: false, reason: "COMPANY_INACTIVE" };

  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: {
      status: true,
      planType: true,
      subscriptionStatus: true,
      trialEndsAt: true,
    },
  });

  if (!company || company.status !== "ACTIVE") {
    return { allowed: false, reason: "COMPANY_INACTIVE" };
  }

  if (company.planType === "LIFETIME_CLOUD" && company.subscriptionStatus === "ACTIVE") {
    return { allowed: true };
  }

  if (company.subscriptionStatus === "ACTIVE") {
    return { allowed: true };
  }

  if (company.subscriptionStatus === "TRIAL") {
    if (!company.trialEndsAt || company.trialEndsAt >= new Date()) {
      return { allowed: true };
    }
    return { allowed: false, reason: "TRIAL_EXPIRED" };
  }

  return { allowed: false, reason: "SUBSCRIPTION_INACTIVE" };
}

export async function requireActiveCompanyAccess(companyId: string | null | undefined) {
  const access = await getCompanyAccessStatus(companyId);
  if (!access.allowed) {
    redirect("/account-suspended");
  }
}

export async function ensureActiveCompanyAccess(companyId: string | null | undefined) {
  const access = await getCompanyAccessStatus(companyId);
  return access.allowed ? null : "Your company account is not active. Please contact support.";
}

export async function hasModuleAccess(companyId: string | null | undefined, moduleKey: ModuleKey) {
  if (!companyId) return false;
  const access = await prisma.companymoduleaccess.findUnique({
    where: {
      companyId_moduleKey: {
        companyId,
        moduleKey,
      },
    },
    select: { isEnabled: true },
  });

  return Boolean(access?.isEnabled);
}

export async function requireModuleAccess(
  companyId: string | null | undefined,
  moduleKey: ModuleKey,
) {
  if (!(await hasModuleAccess(companyId, moduleKey))) {
    redirect("/module-disabled");
  }
}

export async function ensureModuleAccess(
  companyId: string | null | undefined,
  moduleKey: ModuleKey,
) {
  return (await hasModuleAccess(companyId, moduleKey))
    ? null
    : "This module is not enabled for your company plan.";
}

export async function getEnabledModules(companyId: string | null | undefined) {
  if (!companyId) return [];
  const rows = await prisma.companymoduleaccess.findMany({
    where: { companyId, isEnabled: true },
    select: { moduleKey: true },
  });
  return rows.map((row) => row.moduleKey);
}
