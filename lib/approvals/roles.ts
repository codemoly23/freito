import "server-only";
import { prisma } from "@/lib/db/prisma";

// Re-exported for existing server-side callers; import directly from
// approver-roles.ts in anything that might be bundled client-side.
export { APPROVER_ROLE_CODES, isApproverRoleCode, type ApproverRoleCode } from "@/lib/approvals/approver-roles";

async function userHasAllBranchesAccess(userId: string, companyId: string) {
  const count = await prisma.userrole.count({
    where: {
      userId,
      role: { companyId, rolepermission: { some: { permission: { key: "branches:access_all" } } } },
    },
  });
  return count > 0;
}

/**
 * Resolves which users in this company may act on a step requiring
 * `roleCode`: they must hold that role, and either be a member of the
 * request's branch or hold the all-branches capability. Recomputed live at
 * decision time rather than cached, so a membership/role change takes effect
 * immediately.
 */
export async function getEligibleApproverUserIds(companyId: string, branchId: string, roleCode: string): Promise<string[]> {
  const candidates = await prisma.user.findMany({
    where: {
      companyId,
      deletedAt: null,
      status: "ACTIVE",
      userrole: { some: { role: { companyId, code: roleCode as never } } },
    },
    select: { id: true },
  });
  if (candidates.length === 0) return [];

  const eligible: string[] = [];
  for (const candidate of candidates) {
    const hasBranch = await prisma.userbranchmembership.count({ where: { userId: candidate.id, branchId } });
    if (hasBranch > 0) {
      eligible.push(candidate.id);
      continue;
    }
    if (await userHasAllBranchesAccess(candidate.id, companyId)) {
      eligible.push(candidate.id);
    }
  }
  return eligible;
}

export async function isEligibleApprover(userId: string, companyId: string, branchId: string, roleCode: string) {
  const eligible = await getEligibleApproverUserIds(companyId, branchId, roleCode);
  return eligible.includes(userId);
}
