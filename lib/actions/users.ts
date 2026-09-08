"use server";

import { randomUUID } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { userSchema } from "@/lib/validators/admin";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  getStringArray,
  revalidateAdminPaths,
  successState,
  validationError,
} from "@/lib/actions/helpers";

export async function saveUser(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId: scopedCompanyId } =
    await getScopedCompanyId("users:manage");

  const parsed = userSchema.safeParse({
    id: getString(formData, "id") || undefined,
    companyId: getString(formData, "companyId"),
    name: getString(formData, "name"),
    email: getString(formData, "email"),
    password: getString(formData, "password"),
    phone: getString(formData, "phone"),
    designation: getString(formData, "designation"),
    status: getString(formData, "status") || "ACTIVE",
    roleIds: getStringArray(formData, "roleIds"),
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted user fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  if (scopedCompanyId && parsed.data.companyId !== scopedCompanyId) {
    return validationError("You cannot manage users for another company.");
  }

  if (!parsed.data.id && !parsed.data.password) {
    return validationError("Password is required for new users.", {
      password: ["Password is required for new users."],
    });
  }

  try {
    const { id, roleIds, password, ...data } = parsed.data;
    const existingUser = id
      ? await prisma.user.findUnique({ where: { id } })
      : null;

    if (id && (!existingUser || (scopedCompanyId && existingUser.companyId !== scopedCompanyId))) {
      return validationError("User was not found or is outside your company.");
    }

    if (id && existingUser?.scope !== "COMPANY") {
      return validationError("Platform and client users cannot be managed from the company dashboard.");
    }

    const roleCount = await prisma.role.count({
      where: {
        id: { in: roleIds },
        companyId: data.companyId,
      },
    });

    if (roleCount !== roleIds.length) {
      return validationError("Select valid roles from your company.", {
        roleIds: ["Select valid roles from your company."],
      });
    }

    const passwordHash = password ? await hashPassword(password) : undefined;
    const now = new Date();
    const defaultBranch = !id
      ? await prisma.branch.findFirst({
          where: { companyId: data.companyId, isActive: true, deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        })
      : null;

    if (!id && !defaultBranch) {
      return validationError(
        "Create an active branch before adding company users.",
      );
    }

    const savedUser = await prisma.$transaction(async (tx) => {
      const saved = await tx.user.upsert({
        where: { id: id ?? "" },
        update: {
          ...data,
          scope: "COMPANY",
          email: data.email.toLowerCase(),
          updatedAt: now,
          ...(passwordHash ? { passwordHash } : {}),
          userrole: {
            deleteMany: {},
            create: roleIds.map((roleId) => ({ id: randomUUID(), roleId })),
          },
        },
        create: {
          ...data,
          id: randomUUID(),
          scope: "COMPANY",
          email: data.email.toLowerCase(),
          passwordHash: passwordHash!,
          updatedAt: now,
          userrole: {
            create: roleIds.map((roleId) => ({ id: randomUUID(), roleId })),
          },
        },
      });

      // Every company user must begin with a usable branch scope. Administrators
      // can refine that membership from Branch Management afterwards.
      if (!id) {
        await tx.userbranchmembership.create({
          data: {
            id: randomUUID(),
            userId: saved.id,
            branchId: defaultBranch!.id,
            isDefault: true,
            updatedAt: now,
          },
        });
      }
      return saved;
    });

    await audit({
      companyId: savedUser.companyId,
      actorId: user.id,
      action: id ? "user.updated" : "user.created",
      entityType: "User",
      entityId: savedUser.id,
      metadata: { email: savedUser.email },
    });

    if (id && existingUser?.status !== savedUser.status) {
      await audit({
        companyId: savedUser.companyId,
        actorId: user.id,
        action: "USER_STATUS_CHANGED",
        entityType: "User",
        entityId: savedUser.id,
        metadata: { from: existingUser?.status, to: savedUser.status },
      });
    }

    revalidateAdminPaths();
    return successState(id ? "User updated." : "User created.");
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationError("A user with this email already exists.", {
        email: ["A user with this email already exists."],
      });
    }

    throw error;
  }
}

export async function deleteUser(formData: FormData) {
  const { user, companyId: scopedCompanyId } =
    await getScopedCompanyId("users:manage");
  const id = getString(formData, "id");

  const existing = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (scopedCompanyId && existing.companyId !== scopedCompanyId) {
    return;
  }

  const deleted = await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date(), status: "SUSPENDED", updatedAt: new Date() },
  });

  await audit({
    companyId: deleted.companyId,
    actorId: user.id,
    action: "user.deleted",
    entityType: "User",
    entityId: deleted.id,
    metadata: { email: deleted.email },
  });

  revalidateAdminPaths();
}
