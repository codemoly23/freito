import { getCurrentUser } from "@/lib/auth/session";
import { hasModuleAccess } from "@/lib/access/company-access";
import { hasPermission, type PermissionKey } from "@/lib/permissions/rbac";

export async function authorizeExport(permission: PermissionKey, moduleKey: "SHIPMENTS" | "DOCUMENTS" | "QUOTATIONS" | "BILLING") {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, status: 401 };
  if (user.scope !== "COMPANY" || !user.companyId) return { ok: false as const, status: 403 };
  if (!hasPermission(user, permission)) return { ok: false as const, status: 403 };
  if (!(await hasModuleAccess(user.companyId, moduleKey))) return { ok: false as const, status: 403 };
  return { ok: true as const, user, companyId: user.companyId };
}
