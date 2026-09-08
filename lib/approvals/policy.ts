import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { ApprovalDocumentType } from "@/lib/validators/approvals";

/**
 * Resolves the single applicable active policy for a company/documentType/
 * branch combination: a branch-specific active policy wins if one exists,
 * otherwise the company-wide (branchId IS NULL) active policy applies.
 * Returns null when neither exists -- callers must treat that as "no
 * approval gate configured," not an error.
 */
export async function resolveApplicablePolicy(companyId: string, documentType: ApprovalDocumentType, branchId: string) {
  const branchSpecific = await prisma.approvalpolicy.findFirst({
    where: { companyId, documentType, branchId, isActive: true, deletedAt: null },
  });
  if (branchSpecific) return branchSpecific;

  return prisma.approvalpolicy.findFirst({
    where: { companyId, documentType, branchId: null, isActive: true, deletedAt: null },
  });
}

export function policyRequiresApproval(policy: { thresholdAmountBDT: Prisma.Decimal } | null, amountBDT: Prisma.Decimal) {
  if (!policy) return false;
  return amountBDT.greaterThanOrEqualTo(policy.thresholdAmountBDT);
}
