import crypto from "crypto";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { ApprovalDocumentType } from "@/lib/validators/approvals";

export async function submitApprovalRequestTx(
  tx: Prisma.TransactionClient,
  {
    companyId,
    branchId,
    policy,
    documentType,
    vendorBillId,
    paymentId,
    amountBDT,
    submittedById,
  }: {
    companyId: string;
    branchId: string;
    policy: { id: string; approverRoleSequence: string };
    documentType: ApprovalDocumentType;
    vendorBillId?: string | null;
    paymentId?: string | null;
    amountBDT: Prisma.Decimal;
    submittedById: string;
  },
) {
  const roleSequence = JSON.parse(policy.approverRoleSequence) as string[];
  const request = await tx.approvalrequest.create({
    data: {
      id: crypto.randomUUID(),
      companyId,
      branchId,
      policyId: policy.id,
      documentType,
      vendorBillId: vendorBillId ?? null,
      paymentId: paymentId ?? null,
      amountBDT,
      submittedById,
      updatedAt: new Date(),
    },
  });
  await tx.approvalstep.createMany({
    data: roleSequence.map((roleCode, index) => ({
      id: crypto.randomUUID(),
      requestId: request.id,
      sequence: index + 1,
      approverRoleCode: roleCode as never,
      createdAt: new Date(),
    })),
  });
  return request;
}

type DecisionOutcome = "advanced" | "approved" | "rejected";

/** Thrown when two eligible approvers race to decide the exact same step --
 * the caller should show a "someone else already decided this" message
 * rather than treating it as a validation failure on the submitted form. */
export class StepAlreadyDecidedError extends Error {}

/**
 * Records one immutable decision, updates the step it belongs to, and
 * advances or finalizes the parent request. Never applies the underlying
 * business effect (marking a bill received, clearing a payment) -- that's
 * the caller's job once it sees `outcome === "approved"`, keeping this
 * engine document-type-agnostic.
 */
export async function recordDecisionTx(
  tx: Prisma.TransactionClient,
  {
    requestId,
    stepId,
    decidedById,
    decision,
    remarks,
  }: {
    requestId: string;
    stepId: string;
    decidedById: string;
    decision: "APPROVED" | "REJECTED";
    remarks?: string;
  },
): Promise<{ outcome: DecisionOutcome; request: { id: string; branchId: string; companyId: string; documentType: ApprovalDocumentType; vendorBillId: string | null; paymentId: string | null; submittedById: string; amountBDT: Prisma.Decimal; currentSequence: number } }> {
  // Atomic claim: only the first of two concurrent decisions on the same
  // step succeeds (mirrors the notification-dispatch atomic-claim pattern
  // from Phase 02) -- otherwise two eligible approvers racing on the same
  // step could both record a decision and both advance/finalize the request.
  const claimed = await tx.approvalstep.updateMany({
    where: { id: stepId, status: "PENDING" },
    data: { status: decision, decidedById, decidedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new StepAlreadyDecidedError("This step was already decided.");
  }

  await tx.approvaldecision.create({
    data: { id: crypto.randomUUID(), requestId, stepId, decidedById, decision, remarks: remarks ?? null, createdAt: new Date() },
  });

  if (decision === "REJECTED") {
    const request = await tx.approvalrequest.update({
      where: { id: requestId },
      data: { status: "REJECTED", decidedAt: new Date() },
    });
    return { outcome: "rejected", request };
  }

  const totalSteps = await tx.approvalstep.count({ where: { requestId } });
  const current = await tx.approvalrequest.findUniqueOrThrow({ where: { id: requestId } });

  if (current.currentSequence >= totalSteps) {
    const request = await tx.approvalrequest.update({
      where: { id: requestId },
      data: { status: "APPROVED", decidedAt: new Date() },
    });
    return { outcome: "approved", request };
  }

  const request = await tx.approvalrequest.update({
    where: { id: requestId },
    data: { currentSequence: { increment: 1 } },
  });
  return { outcome: "advanced", request };
}
