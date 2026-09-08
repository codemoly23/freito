"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  revalidateAdminPaths,
  successState,
  validationError,
} from "@/lib/actions/helpers";

function optional(value: string) {
  const normalized = value.trim();
  return normalized || null;
}

type BranchInput = {
  id?: string;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

function branchInput(formData: FormData): { data: BranchInput } | { error: string } {
  const id = getString(formData, "id");
  const name = getString(formData, "name").trim();
  const code = getString(formData, "code").trim().toUpperCase();
  const email = optional(getString(formData, "email"));

  if (name.length < 2) return { error: "Branch name must be at least 2 characters." };
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
    return { error: "Branch code must use 2–32 uppercase letters, numbers, hyphens, or underscores." };
  }
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid branch email address." };

  return {
    data: {
      id: id || undefined,
      name,
      code,
      email,
      phone: optional(getString(formData, "phone")),
      address: optional(getString(formData, "address")),
    },
  };
}

export async function saveBranch(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("branches:manage");
  const parsed = branchInput(formData);
  if (!("data" in parsed)) return validationError(parsed.error);
  const { id, ...branchData } = parsed.data;

  const existing = id
    ? await prisma.branch.findFirst({ where: { id, companyId, deletedAt: null } })
    : null;
  if (id && !existing) return validationError("Branch not found in your company.");

  const now = new Date();
  try {
    const branch = existing
      ? await prisma.branch.update({ where: { id: existing.id }, data: { ...branchData, updatedAt: now } })
      : await prisma.branch.create({
          data: { id: randomUUID(), companyId, ...branchData, updatedAt: now },
        });

    await audit({
      companyId,
      actorId: user.id,
      action: existing ? "branch.updated" : "branch.created",
      entityType: "Branch",
      entityId: branch.id,
      metadata: { code: branch.code, name: branch.name },
    });
    revalidateAdminPaths();
    return successState(existing ? "Branch updated." : "Branch created.");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return validationError("That branch code is already in use for this company.", { code: ["Choose a unique code."] });
    }
    throw error;
  }
}

export async function setBranchStatus(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("branches:manage");
  const id = getString(formData, "id");
  const isActive = getString(formData, "isActive") === "true";
  const branch = await prisma.branch.findFirst({ where: { id, companyId, deletedAt: null } });
  if (!branch) return;

  if (!isActive) {
    const activeCount = await prisma.branch.count({ where: { companyId, deletedAt: null, isActive: true } });
    if (activeCount <= 1) redirect("/dashboard/branches?branchError=last-active");
    // An inactive default membership would leave staff unable to create or
    // update branch-owned records. Reassign defaults before deactivating.
    const defaultMembershipCount = await prisma.userbranchmembership.count({
      where: { branchId: id, isDefault: true },
    });
    if (defaultMembershipCount > 0) redirect("/dashboard/branches?branchError=has-default-members");
  }

  await prisma.branch.update({ where: { id }, data: { isActive, updatedAt: new Date() } });
  await audit({
    companyId,
    actorId: user.id,
    action: isActive ? "branch.activated" : "branch.deactivated",
    entityType: "Branch",
    entityId: id,
    metadata: { code: branch.code },
  });
  revalidateAdminPaths();
}

export async function saveBranchMembership(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user: actor, companyId } = await getScopedCompanyId("branches:manage");
  const userId = getString(formData, "userId");
  const branchId = getString(formData, "branchId");
  const isDefault = getString(formData, "isDefault") === "true";
  if (!userId || !branchId) return validationError("Select both a user and a branch.");

  const [memberUser, branch] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, companyId, scope: "COMPANY", deletedAt: null }, select: { id: true, name: true } }),
    prisma.branch.findFirst({ where: { id: branchId, companyId, isActive: true, deletedAt: null }, select: { id: true, name: true } }),
  ]);
  if (!memberUser || !branch) return validationError("User or active branch is outside your company.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.userbranchmembership.updateMany({ where: { userId }, data: { isDefault: false, updatedAt: now } });
    }
    await tx.userbranchmembership.upsert({
      where: { userId_branchId: { userId, branchId } },
      update: { isDefault, updatedAt: now },
      create: { id: randomUUID(), userId, branchId, isDefault, updatedAt: now },
    });
  });
  await audit({
    companyId,
    actorId: actor.id,
    action: "branch.membership_saved",
    entityType: "UserBranchMembership",
    entityId: `${userId}:${branchId}`,
    metadata: { userId, branchId, isDefault },
  });
  revalidateAdminPaths();
  return successState(`${memberUser.name} can now access ${branch.name}.`);
}

export async function removeBranchMembership(formData: FormData) {
  const { user: actor, companyId } = await getScopedCompanyId("branches:manage");
  const userId = getString(formData, "userId");
  const branchId = getString(formData, "branchId");
  const membership = await prisma.userbranchmembership.findFirst({
    where: { userId, branchId, user: { companyId } },
  });
  if (!membership || membership.isDefault) return;

  await prisma.userbranchmembership.delete({ where: { id: membership.id } });
  await audit({
    companyId,
    actorId: actor.id,
    action: "branch.membership_removed",
    entityType: "UserBranchMembership",
    entityId: membership.id,
    metadata: { userId, branchId },
  });
  revalidateAdminPaths();
}
