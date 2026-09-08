import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/access/company-access";
import { getScopedCompanyId } from "@/lib/actions/helpers";
import { hasPermission } from "@/lib/permissions/rbac";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";

export type ReportSection =
  | "operations"
  | "requests"
  | "quotations"
  | "documents"
  | "workflow"
  | "financial"
  | "customers"
  | "vendors";

export function canAccessReportSection(
  user: { roles?: string[]; permissions?: string[] },
  section: ReportSection,
) {
  if (!hasPermission(user, "reports:view")) return false;
  const roles = new Set(user.roles ?? []);
  if (roles.has("COMPANY_ADMIN")) return true;
  if (section === "financial") return hasPermission(user, "reports:financial");
  if (["customers", "vendors"].includes(section) && hasPermission(user, "reports:financial")) return true;
  if (!hasPermission(user, "reports:operations")) return false;
  if (roles.has("OPERATIONS_MANAGER")) return true;
  if (roles.has("SALES_EXECUTIVE")) {
    return ["operations", "requests", "quotations", "customers"].includes(section);
  }
  if (roles.has("DOCUMENTATION_OFFICER")) {
    return ["documents", "workflow"].includes(section);
  }
  return false;
}

export async function requireReportsPage(section?: ReportSection) {
  const { user, companyId } = await getScopedCompanyId("reports:view");
  await requireModuleAccess(companyId, "REPORTS");
  if (section && !canAccessReportSection(user, section)) {
    redirect("/dashboard/reports?access=denied");
  }
  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId,
    permissions: user.permissions ?? [],
  });
  return { user, companyId, branchWhere: branchScopeWhere(accessibleBranchIds) };
}
