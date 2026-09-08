import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@/lib/generated/prisma/client";
import { redirect } from "next/navigation";
import { ensureActiveCompanyAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { requirePermission, type PermissionKey } from "@/lib/permissions/rbac";

export type ActionState = {
  ok?: boolean;
  message?: string;
  activationLink?: string;
  errors?: Record<string, string[] | undefined>;
};

export function getString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

export function getStringArray(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

export function validationError(
  message: string,
  errors?: ActionState["errors"],
): ActionState {
  return { ok: false, message, errors };
}

export function successState(message: string): ActionState {
  return { ok: true, message };
}

export function getFormData(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
) {
  return maybeFormData ?? (stateOrFormData as FormData);
}

export async function getScopedCompanyId(permission: PermissionKey) {
  const user = await requirePermission(permission);

  if (user.scope !== "COMPANY" || !user.companyId) {
    redirect("/dashboard?access=denied");
  }

  const companyAccessError = await ensureActiveCompanyAccess(user.companyId);
  if (companyAccessError) {
    redirect("/account-suspended");
  }

  return { user, companyId: user.companyId };
}

export function revalidateAdminPaths() {
  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard/companies");
  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/roles");
  revalidatePath("/dashboard/customers");
  revalidatePath("/dashboard/vendors");
  revalidatePath("/dashboard/shipments");
  revalidatePath("/dashboard/shipment-requests");
  revalidatePath("/dashboard/quotations");
  revalidatePath("/dashboard");
}

export function revalidateQuotationPaths(quotationId: string) {
  revalidateAdminPaths();
  revalidatePath(`/dashboard/quotations/${quotationId}`);
  revalidatePath(`/dashboard/quotations/${quotationId}/edit`);
  revalidatePath(`/dashboard/quotations/${quotationId}/print`);
}

export async function audit({
  companyId,
  actorId,
  action,
  entityType,
  entityId,
  metadata,
}: {
  companyId?: string | null;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditlog.create({
    data: {
      id: randomUUID(),
      companyId,
      actorId,
      action,
      entityType,
      entityId,
      metadata: metadata ? (typeof metadata === "string" ? metadata : JSON.stringify(metadata)) : null,
    },
  });
}
