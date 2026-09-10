import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission, type PermissionKey } from "@/lib/permissions/rbac";
import { getCompanyAccessStatus, hasModuleAccess } from "@/lib/access/company-access";

export type AuditScopedCompany = {
  user: Awaited<ReturnType<typeof requirePermission>>;
  companyId: string | null;
  isAudit: boolean;
  companyName: string | null;
};

/**
 * Resolves which company's data the caller should see for the 3 accounting
 * reports. Used ONLY by those reports — every write action in the app
 * (billing.ts, shipments, quotations, ...) keeps calling `getScopedCompanyId`
 * unchanged, which always reads the user's home `companyId`. Switching
 * companies can therefore never affect what a user can write, only what
 * these specific reports let them read.
 *
 * Re-validates on every call rather than trusting the session's
 * `activeCompanyId` claim outright: the permission, the live grant row, and
 * the target company's own status/module access are all checked fresh, so a
 * revoked grant or a suspended target company takes effect immediately
 * (the JWT claim is a hint for which company to look up, not the authority
 * that it's allowed). Any failure falls back to the user's home company —
 * a report showing your own data instead of someone else's is never a
 * security problem, so this never throws or blocks the page.
 */
export async function getAuditScopedCompanyId(permission: PermissionKey): Promise<AuditScopedCompany> {
  const user = await requirePermission(permission);
  const homeCompanyId = user.companyId;
  const requestedCompanyId = user.activeCompanyId ?? homeCompanyId;

  const fallbackToHome = (): AuditScopedCompany => ({
    user,
    companyId: homeCompanyId,
    isAudit: false,
    companyName: user.companyName ?? null,
  });

  if (!requestedCompanyId || requestedCompanyId === homeCompanyId) {
    return fallbackToHome();
  }

  if (!hasPermission(user, "companies:switch")) {
    return fallbackToHome();
  }

  const grant = await prisma.usercompanyaccess.findUnique({
    where: { userId_companyId: { userId: user.id, companyId: requestedCompanyId } },
  });
  if (!grant) {
    return fallbackToHome();
  }

  const [targetCompany, accessStatus, moduleOk] = await Promise.all([
    prisma.company.findFirst({ where: { id: requestedCompanyId, deletedAt: null }, select: { name: true } }),
    getCompanyAccessStatus(requestedCompanyId),
    hasModuleAccess(requestedCompanyId, "REPORTS"),
  ]);
  if (!targetCompany || !accessStatus.allowed || !moduleOk) {
    return fallbackToHome();
  }

  return { user, companyId: requestedCompanyId, isAudit: true, companyName: targetCompany.name };
}
