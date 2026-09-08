import { requireModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { getScopedCompanyId } from "@/lib/actions/helpers";
import type { PermissionKey } from "@/lib/permissions/rbac";

export async function requireBillingPage(permission: PermissionKey) {
  const { user, companyId } = await getScopedCompanyId(permission);
  await requireModuleAccess(companyId, "BILLING");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  return { user, companyId, branchWhere: branchScopeWhere(accessibleBranchIds) };
}

export function money(value: unknown, currency = "BDT") {
  return `${currency} ${Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function billingStatusVariant(status: string) {
  if (status === "PAID" || status === "CLEARED") return "success" as const;
  if (status === "CANCELLED" || status === "BOUNCED" || status === "OVERDUE") return "danger" as const;
  if (status === "SENT" || status === "RECEIVED" || status === "PARTIALLY_PAID") return "warning" as const;
  return "secondary" as const;
}

type EffectiveBillingStatusInput = {
  status: string;
  dueDate?: Date | null;
  dueAmount: unknown;
};

function isPastDue({ dueDate, dueAmount }: EffectiveBillingStatusInput) {
  if (!dueDate || Number(dueAmount) <= 0) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

export function getEffectiveInvoiceStatus(invoice: EffectiveBillingStatusInput) {
  if (invoice.status === "CANCELLED") return "CANCELLED";
  if (invoice.status === "PAID" || Number(invoice.dueAmount) <= 0) return "PAID";
  return isPastDue(invoice) ? "OVERDUE" : invoice.status;
}

export function getEffectiveVendorBillStatus(bill: EffectiveBillingStatusInput) {
  if (bill.status === "CANCELLED") return "CANCELLED";
  if (bill.status === "PAID" || Number(bill.dueAmount) <= 0) return "PAID";
  return isPastDue(bill) ? "OVERDUE" : bill.status;
}
