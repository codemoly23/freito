"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { approvalPolicySchema } from "@/lib/validators/approvals";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  getStringArray,
  successState,
  validationError,
} from "@/lib/actions/helpers";

const PATH = "/dashboard/settings/approval-policies";

export async function saveApprovalPolicy(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("approvalPolicies:manage");

  const id = getString(formData, "id") || undefined;
  const branchIdRaw = getString(formData, "branchId");

  const parsed = approvalPolicySchema.safeParse({
    documentType: getString(formData, "documentType"),
    name: getString(formData, "name"),
    branchId: branchIdRaw || undefined,
    thresholdAmountBDT: getString(formData, "thresholdAmountBDT"),
    approverRoleSequence: getStringArray(formData, "approverRoleSequence"),
  });
  if (!parsed.success) {
    return validationError("Please fix the policy fields.", parsed.error.flatten().fieldErrors);
  }

  if (parsed.data.branchId) {
    const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
    const branch = await prisma.branch.findFirst({
      where: { id: parsed.data.branchId, companyId, isActive: true, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    });
    if (!branch) return validationError("Select a valid branch from this company.");
  }

  if (id) {
    const existing = await prisma.approvalpolicy.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!existing) return validationError("Policy was not found.");
  }

  try {
    const policy = id
      ? await prisma.approvalpolicy.update({
          where: { id },
          data: {
            name: parsed.data.name,
            branchId: parsed.data.branchId ?? null,
            thresholdAmountBDT: new Prisma.Decimal(parsed.data.thresholdAmountBDT),
            approverRoleSequence: JSON.stringify(parsed.data.approverRoleSequence),
            updatedAt: new Date(),
          },
        })
      : await prisma.approvalpolicy.create({
          data: {
            id: crypto.randomUUID(),
            companyId,
            documentType: parsed.data.documentType,
            name: parsed.data.name,
            branchId: parsed.data.branchId ?? null,
            thresholdAmountBDT: new Prisma.Decimal(parsed.data.thresholdAmountBDT),
            approverRoleSequence: JSON.stringify(parsed.data.approverRoleSequence),
            createdById: user.id,
            updatedAt: new Date(),
          },
        });

    await audit({
      companyId,
      actorId: user.id,
      action: id ? "approvalpolicy.updated" : "approvalpolicy.created",
      entityType: "ApprovalPolicy",
      entityId: policy.id,
      metadata: { documentType: policy.documentType, name: policy.name, branchId: policy.branchId },
    });

    revalidatePath(PATH);
    return successState(id ? "Policy updated." : "Policy created.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return validationError("A policy for this document type and branch already exists.");
    }
    throw error;
  }
}

async function loadOwnedPolicy(companyId: string, policyId: string) {
  return prisma.approvalpolicy.findFirst({ where: { id: policyId, companyId, deletedAt: null } });
}

export async function activateApprovalPolicy(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("approvalPolicies:manage");
  const policyId = getString(formData, "id");
  const policy = await loadOwnedPolicy(companyId, policyId);
  if (!policy) return;

  await prisma.approvalpolicy.update({ where: { id: policyId }, data: { isActive: true } });

  await audit({
    companyId,
    actorId: user.id,
    action: "approvalpolicy.activated",
    entityType: "ApprovalPolicy",
    entityId: policyId,
    metadata: { documentType: policy.documentType, name: policy.name },
  });

  revalidatePath(PATH);
}

export async function deactivateApprovalPolicy(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("approvalPolicies:manage");
  const policyId = getString(formData, "id");
  const policy = await loadOwnedPolicy(companyId, policyId);
  if (!policy) return;

  await prisma.approvalpolicy.update({ where: { id: policyId }, data: { isActive: false } });

  await audit({
    companyId,
    actorId: user.id,
    action: "approvalpolicy.deactivated",
    entityType: "ApprovalPolicy",
    entityId: policyId,
    metadata: { documentType: policy.documentType, name: policy.name },
  });

  revalidatePath(PATH);
}

export async function deleteApprovalPolicy(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("approvalPolicies:manage");
  const policyId = getString(formData, "id");
  const policy = await loadOwnedPolicy(companyId, policyId);
  if (!policy) return;

  await prisma.approvalpolicy.update({
    where: { id: policyId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "approvalpolicy.deleted",
    entityType: "ApprovalPolicy",
    entityId: policyId,
    metadata: { documentType: policy.documentType, name: policy.name },
  });

  revalidatePath(PATH);
}
