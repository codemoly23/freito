"use server";

import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";

/**
 * Validates that the caller may switch into `targetCompanyId` (returning to
 * their own home company is always allowed). Only validates the switch —
 * the client is responsible for calling `useSession().update({ activeCompanyId })`
 * afterwards to actually persist it into the session. This function does
 * NOT redirect on failure (unlike `requirePermission`) since it's called
 * directly from an interactive dropdown, not a page load.
 */
export async function switchActiveCompany(targetCompanyId: string): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY") {
    return { ok: false, message: "Not signed in." };
  }
  if (targetCompanyId === user.companyId) {
    return { ok: true };
  }
  if (!hasPermission(user, "companies:switch")) {
    return { ok: false, message: "You do not have permission to switch companies." };
  }

  const grant = await prisma.usercompanyaccess.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: targetCompanyId } },
  });
  if (!grant) {
    return { ok: false, message: "You do not have access to that company." };
  }

  const company = await prisma.company.findFirst({ where: { id: targetCompanyId, deletedAt: null }, select: { id: true } });
  if (!company) {
    return { ok: false, message: "Company was not found." };
  }

  return { ok: true };
}

/**
 * Companies this user may switch into for report viewing — their own home
 * company plus every company an admin has explicitly granted them access
 * to via `usercompanyaccess`. Empty (not just the home company) when the
 * user lacks `companies:switch`, so the switcher UI can hide itself
 * entirely for everyone else.
 */
export async function getSwitchableCompanies(): Promise<{ id: string; name: string }[]> {
  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY" || !hasPermission(user, "companies:switch")) return [];

  const grants = await prisma.usercompanyaccess.findMany({
    where: { userId: user.id },
    include: { company: { select: { id: true, name: true, deletedAt: true } } },
  });

  const companies = grants
    .map((grant) => grant.company)
    .filter((company) => !company.deletedAt)
    .map((company) => ({ id: company.id, name: company.name }));

  if (user.companyId && !companies.some((company) => company.id === user.companyId)) {
    const home = await prisma.company.findUnique({ where: { id: user.companyId }, select: { id: true, name: true } });
    if (home) companies.unshift(home);
  }

  return companies;
}
