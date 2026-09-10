import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/access/company-access";
import { getAuditScopedCompanyId } from "@/lib/access/audit-scope";
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
  | "accounting"
  | "customers"
  | "vendors";

export function canAccessReportSection(
  user: { roles?: string[]; permissions?: string[] },
  section: ReportSection,
) {
  if (!hasPermission(user, "reports:view")) return false;
  const roles = new Set(user.roles ?? []);
  if (roles.has("COMPANY_ADMIN")) return true;
  if (section === "accounting") return hasPermission(user, "reports:accounting");
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

/**
 * The accounting-report equivalent of `requireReportsPage("accounting")`,
 * except the company it scopes to can be the caller's switched/audit
 * company instead of their home one (see `getAuditScopedCompanyId`). Used
 * only by the Trial Balance / P&L / Balance Sheet fetchers and pages —
 * every other report section keeps using `requireReportsPage`, which is
 * always scoped to the home company.
 */
export async function requireAccountingReportsPage() {
  const { user, companyId, isAudit, companyName } = await getAuditScopedCompanyId("reports:view");
  if (!companyId || !canAccessReportSection(user, "accounting")) {
    redirect("/dashboard/reports?access=denied");
  }
  await requireModuleAccess(companyId, "REPORTS");
  return { user, companyId, isAudit, companyName };
}
