"use server";

import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { companySchema } from "@/lib/validators/admin";
import {
  type ActionState,
  audit,
  getFormData,
  getString,
  revalidateAdminPaths,
  successState,
  validationError,
} from "@/lib/actions/helpers";
import { requirePlatformPermission } from "@/lib/permissions/rbac";

export async function saveCompany(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const user = await requirePlatformPermission(
    id ? "platform:companies:update" : "platform:companies:create",
  );
  const parsed = companySchema.safeParse({
    id,
    name: getString(formData, "name"),
    legalName: getString(formData, "legalName"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    address: getString(formData, "address"),
    status: getString(formData, "status") || "ACTIVE",
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted company fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { id: parsedId, ...data } = parsed.data;
  const previousCompany = parsedId
    ? await prisma.company.findUnique({ where: { id: parsedId } })
    : null;

  const company = parsedId
    ? await prisma.company.update({ where: { id: parsedId }, data: { ...data, updatedAt: new Date() } })
    : await prisma.company.create({ data: { id: crypto.randomUUID(), ...data, updatedAt: new Date() } });

  await audit({
    companyId: company.id,
    actorId: user.id,
    action: parsedId ? "company.updated" : "company.created",
    entityType: "Company",
    entityId: company.id,
    metadata: { name: company.name },
  });

  if (parsedId && previousCompany?.status !== company.status) {
    await audit({
      companyId: company.id,
      actorId: user.id,
      action: "COMPANY_STATUS_CHANGED",
      entityType: "Company",
      entityId: company.id,
      metadata: { from: previousCompany?.status, to: company.status },
    });
  }

  revalidateAdminPaths();
  return successState(id ? "Company updated." : "Company created.");
}

export async function deleteCompany(formData: FormData) {
  const user = await requirePlatformPermission("platform:companies:suspend");
  const id = getString(formData, "id");

  const company = await prisma.company.update({
    where: { id },
    data: { deletedAt: new Date(), status: "SUSPENDED" },
  });

  await audit({
    companyId: company.id,
    actorId: user.id,
    action: "company.deleted",
    entityType: "Company",
    entityId: company.id,
    metadata: { name: company.name },
  });

  revalidateAdminPaths();
}
