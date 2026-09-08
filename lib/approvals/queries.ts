import { prisma } from "@/lib/db/prisma";
import { isEligibleApprover } from "@/lib/approvals/roles";

export async function listApprovalPolicies(companyId: string) {
  return prisma.approvalpolicy.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ documentType: "asc" }, { createdAt: "asc" }],
    include: { branch: { select: { id: true, name: true } } },
  });
}

/** Pending vendor bill/payment approval requests where this user holds the
 * required role for the CURRENT step, is branch-eligible, AND actually holds
 * the underlying `vendorBills:approve`/`payments:approve` permission --
 * excludes anything they themselves submitted. A step whose required role
 * lacks the matching approve permission simply never appears here for
 * anyone, which is a policy misconfiguration to fix in Roles, not a security
 * gap (it fails closed: nobody can decide it, rather than the wrong person
 * deciding it). Eligibility is recomputed live per request, not cached. */
export async function getMyPendingApprovals(user: { id: string; companyId?: string | null; permissions?: string[] }) {
  if (!user.companyId) return [];
  const companyId = user.companyId;
  const permissions = user.permissions ?? [];

  const userRoles = await prisma.userrole.findMany({
    where: { userId: user.id, role: { companyId } },
    select: { role: { select: { code: true } } },
  });
  const roleCodes = new Set(userRoles.map((entry) => entry.role.code));
  if (roleCodes.size === 0) return [];

  const requests = await prisma.approvalrequest.findMany({
    where: { companyId, status: "PENDING", submittedById: { not: user.id } },
    include: {
      approvalstep: { orderBy: { sequence: "asc" } },
      vendorbill: { select: { billNo: true, totalAmount: true, currency: true, vendor: { select: { name: true } } } },
      payment: { select: { paymentNo: true, amount: true, currency: true, direction: true } },
      user: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: { submittedAt: "asc" },
  });

  const mine: typeof requests = [];
  for (const request of requests) {
    const requiredPermission = request.documentType === "VENDOR_BILL" ? "vendorBills:approve" : "payments:approve";
    if (!permissions.includes(requiredPermission)) continue;
    const currentStep = request.approvalstep.find((step) => step.sequence === request.currentSequence);
    if (!currentStep || !roleCodes.has(currentStep.approverRoleCode)) continue;
    if (!(await isEligibleApprover(user.id, companyId, request.branchId, currentStep.approverRoleCode))) continue;
    mine.push(request);
  }
  return mine;
}

export async function getApprovalRequestForVendorBill(vendorBillId: string) {
  return prisma.approvalrequest.findFirst({
    where: { vendorBillId, status: { in: ["PENDING", "REJECTED"] } },
    orderBy: { submittedAt: "desc" },
    select: { id: true, status: true, currentSequence: true },
  });
}
