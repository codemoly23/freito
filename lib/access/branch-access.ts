import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Branch scope is deliberately independent of company roles. A caller must
 * already have the relevant company permission; this helper only decides which
 * branches that caller may operate in. `null` means every live branch in the
 * current company is available through the explicit all-branches permission.
 */
export async function getAccessibleBranchIds({
  userId,
  companyId,
  permissions,
}: {
  userId: string;
  companyId: string;
  permissions: string[];
}): Promise<string[] | null> {
  if (permissions.includes("branches:access_all")) return null;

  const memberships = await prisma.userbranchmembership.findMany({
    where: {
      userId,
      branch: { companyId, isActive: true, deletedAt: null },
    },
    select: { branchId: true },
  });
  return memberships.map((membership) => membership.branchId);
}

export async function requireBranchAccess({
  userId,
  companyId,
  permissions,
  branchId,
}: {
  userId: string;
  companyId: string;
  permissions: string[];
  branchId: string;
}) {
  const accessibleIds = await getAccessibleBranchIds({ userId, companyId, permissions });
  if (accessibleIds === null) {
    return prisma.branch.findFirst({ where: { id: branchId, companyId, isActive: true, deletedAt: null } });
  }
  if (!accessibleIds.includes(branchId)) return null;
  return prisma.branch.findFirst({ where: { id: branchId, companyId, isActive: true, deletedAt: null } });
}

export async function getDefaultBranchId(userId: string, companyId: string) {
  const membership = await prisma.userbranchmembership.findFirst({
    where: {
      userId,
      isDefault: true,
      branch: { companyId, isActive: true, deletedAt: null },
    },
    select: { branchId: true },
  });
  return membership?.branchId ?? null;
}

/** Default operational branch for system-originated records (for example,
 * client-portal submissions that do not have an internal user membership). */
export async function getCompanyDefaultBranchId(companyId: string) {
  const branch = await prisma.branch.findFirst({
    where: { companyId, isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return branch?.id ?? null;
}

/**
 * Safe fallback for shared record loaders. Company users are always limited to
 * their memberships; platform and portal callers have their own company/client
 * ownership checks and therefore receive no additional branch fragment here.
 */
export async function getCurrentBranchScope(companyId: string): Promise<string[] | null> {
  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY") return null;
  if (user.companyId !== companyId) return [];
  return getAccessibleBranchIds({
    userId: user.id,
    companyId,
    permissions: user.permissions ?? [],
  });
}

/**
 * Prisma `where` fragment that limits a query to the caller's accessible
 * branches. `null` (all-branches) yields no extra filter.
 */
export function branchScopeWhere(accessibleBranchIds: string[] | null) {
  if (accessibleBranchIds === null) return {};
  return { branchId: { in: accessibleBranchIds } };
}

/**
 * Same as `branchScopeWhere`, but for tables where `branchId` is itself
 * nullable (e.g. notification/notificationdelivery, which also carry
 * PLATFORM-scope rows with no company/branch at all). A null branchId is
 * always visible -- it was never assigned a branch owner, so it isn't a
 * cross-branch record to hide -- rows with a real branchId are still scoped.
 */
export function branchScopeWhereNullable(accessibleBranchIds: string[] | null) {
  if (accessibleBranchIds === null) return {};
  return { OR: [{ branchId: null }, { branchId: { in: accessibleBranchIds } }] };
}

/**
 * Resolves both the read-scope (accessibleBranchIds) and the write-default
 * (the caller's default branch) in one call, for use in server actions that
 * create or query branch-owned records.
 */
export async function getBranchWriteScope({
  userId,
  companyId,
  permissions,
}: {
  userId: string;
  companyId: string;
  permissions: string[];
}): Promise<{ accessibleBranchIds: string[] | null; defaultBranchId: string | null }> {
  const [accessibleBranchIds, defaultBranchId] = await Promise.all([
    getAccessibleBranchIds({ userId, companyId, permissions }),
    getDefaultBranchId(userId, companyId),
  ]);
  return { accessibleBranchIds, defaultBranchId };
}

/**
 * Validates a caller-supplied branchId against their accessible branches and
 * the target company. Returns the branch id to persist, or `null` if the
 * requested branch is invalid/inaccessible and the caller has no default to
 * fall back to.
 */
export async function resolveWritableBranchId({
  companyId,
  accessibleBranchIds,
  defaultBranchId,
  requestedBranchId,
}: {
  companyId: string;
  accessibleBranchIds: string[] | null;
  defaultBranchId: string | null;
  requestedBranchId?: string | null;
}): Promise<string | null> {
  if (!requestedBranchId) return defaultBranchId;
  if (accessibleBranchIds !== null && !accessibleBranchIds.includes(requestedBranchId)) {
    return null;
  }
  const branch = await prisma.branch.findFirst({
    where: { id: requestedBranchId, companyId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  return branch?.id ?? null;
}
