"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { recordDecisionTx, StepAlreadyDecidedError } from "@/lib/approvals/engine";
import { getEligibleApproverUserIds, isEligibleApprover } from "@/lib/approvals/roles";
import { approvalDecisionSchema } from "@/lib/validators/approvals";
import { applyApprovedPayment, applyApprovedVendorBillReceipt } from "@/lib/actions/billing";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatch-event";
import { ensureActiveCompanyAccess, ensureModuleAccess } from "@/lib/access/company-access";
import { hasPermission, requireUserScope } from "@/lib/permissions/rbac";
import {
  type ActionState,
  audit,
  getFormData,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

async function notifySafely(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    console.error("Approval notification dispatch failed.", error instanceof Error ? error.message : error);
  }
}

async function resolveDocumentNo(documentType: "VENDOR_BILL" | "PAYMENT", vendorBillId: string | null, paymentId: string | null) {
  if (documentType === "VENDOR_BILL" && vendorBillId) {
    const bill = await prisma.vendorbill.findUnique({ where: { id: vendorBillId }, select: { billNo: true } });
    return bill?.billNo ?? "";
  }
  if (documentType === "PAYMENT" && paymentId) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId }, select: { paymentNo: true } });
    return payment?.paymentNo ?? "";
  }
  return "";
}

export async function decideApproval(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);

  // The permission required depends on the request's OWN documentType, not
  // on anything the client submits -- a hidden form field cannot be trusted
  // to pick which permission gets checked (that would let a vendorBills:approve
  // holder tamper the field to decide a PAYMENT request). So: authenticate the
  // company user first, load the request server-side, and only then check the
  // permission that matches its real, server-known documentType.
  const user = await requireUserScope("COMPANY");
  if (!user.companyId) return validationError("A company scope is required.");
  const companyId = user.companyId;

  const companyAccessError = await ensureActiveCompanyAccess(companyId);
  if (companyAccessError) return validationError(companyAccessError);

  const moduleError = await ensureModuleAccess(companyId, "BILLING");
  if (moduleError) return validationError(moduleError);

  const parsed = approvalDecisionSchema.safeParse({
    requestId: getString(formData, "requestId"),
    decision: getString(formData, "decision"),
    remarks: getString(formData, "remarks"),
  });
  if (!parsed.success) return validationError("Invalid decision.");

  const request = await prisma.approvalrequest.findFirst({
    where: { id: parsed.data.requestId, companyId, status: "PENDING" },
    include: { approvalstep: { orderBy: { sequence: "asc" } } },
  });
  if (!request) return validationError("Approval request was not found or is no longer pending.");

  const requiredPermission = request.documentType === "PAYMENT" ? "payments:approve" : "vendorBills:approve";
  if (!hasPermission(user, requiredPermission)) {
    return validationError("You do not have permission to decide this approval.");
  }

  if (request.submittedById === user.id) {
    return validationError("You cannot approve or reject your own submission.");
  }

  const currentStep = request.approvalstep.find((step) => step.sequence === request.currentSequence);
  if (!currentStep || currentStep.status !== "PENDING") {
    return validationError("This request is not waiting on a decision right now.");
  }

  const eligible = await isEligibleApprover(user.id, companyId, request.branchId, currentStep.approverRoleCode);
  if (!eligible) return validationError("You are not an eligible approver for this step.");

  let result;
  try {
    result = await prisma.$transaction((tx) =>
      recordDecisionTx(tx, {
        requestId: request.id,
        stepId: currentStep.id,
        decidedById: user.id,
        decision: parsed.data.decision,
        remarks: parsed.data.remarks,
      }),
    );
  } catch (error) {
    if (error instanceof StepAlreadyDecidedError) {
      return validationError("Someone else already decided this step. Refresh to see the current state.");
    }
    throw error;
  }

  await audit({
    companyId,
    actorId: user.id,
    action: parsed.data.decision === "APPROVED" ? "approvalrequest.step_approved" : "approvalrequest.step_rejected",
    entityType: "ApprovalRequest",
    entityId: request.id,
    metadata: { documentType: request.documentType, sequence: currentStep.sequence, remarks: parsed.data.remarks },
  });

  if (result.outcome === "approved") {
    if (request.documentType === "VENDOR_BILL" && request.vendorBillId) {
      await applyApprovedVendorBillReceipt(request.vendorBillId, companyId, user.id);
    } else if (request.documentType === "PAYMENT" && request.paymentId) {
      await applyApprovedPayment(request.paymentId, companyId, user.id);
    }
  } else if (result.outcome === "rejected" && request.documentType === "PAYMENT" && request.paymentId) {
    // The payment row was created PENDING with no financial effect applied
    // yet -- rejecting just cancels it, exactly like a manual reversal.
    await prisma.payment.update({ where: { id: request.paymentId }, data: { status: "CANCELLED" } });
  }

  await notifySafely(async () => {
    const documentLabel = request.documentType === "VENDOR_BILL" ? "Vendor bill" : "Payment";
    const documentNo = await resolveDocumentNo(request.documentType, request.vendorBillId, request.paymentId);

    if (result.outcome !== "advanced") {
      await dispatchNotificationEvent({
        eventKey: "approval_decided",
        companyId,
        branchId: request.branchId,
        entityId: request.id,
        internalRecipientUserId: request.submittedById,
        variables: {
          documentLabel,
          documentNo,
          decision: result.outcome,
          decidedByName: user.name ?? "",
          remarksSuffix: parsed.data.remarks ? ` (${parsed.data.remarks})` : "",
        },
      });
      return;
    }

    const nextStep = request.approvalstep.find((step) => step.sequence === currentStep.sequence + 1);
    if (!nextStep) return;
    const approverIds = await getEligibleApproverUserIds(companyId, request.branchId, nextStep.approverRoleCode);
    for (const approverId of approverIds) {
      await dispatchNotificationEvent({
        eventKey: "approval_requested",
        companyId,
        branchId: request.branchId,
        entityId: request.id,
        internalRecipientUserId: approverId,
        variables: {
          documentLabel,
          documentNo,
          amount: request.amountBDT.toFixed(2),
          currency: "BDT",
          stepSequence: nextStep.sequence,
          stepCount: request.approvalstep.length,
        },
        internalLinkUrl: "/dashboard/approvals",
      });
    }
  });

  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/vendor-bills");
  revalidatePath("/dashboard/payments");
  return successState(parsed.data.decision === "APPROVED" ? "Decision recorded: approved." : "Decision recorded: rejected.");
}
