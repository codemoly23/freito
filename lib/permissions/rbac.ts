import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const permissions = {
  platformCompaniesView: "platform:companies:view",
  platformCompaniesCreate: "platform:companies:create",
  platformCompaniesUpdate: "platform:companies:update",
  platformCompaniesSuspend: "platform:companies:suspend",
  platformSubscriptionsView: "platform:subscriptions:view",
  platformSubscriptionsUpdate: "platform:subscriptions:update",
  platformLicensesView: "platform:licenses:view",
  platformLicensesUpdate: "platform:licenses:update",
  platformModulesUpdate: "platform:modules:update",
  platformSupportAccess: "platform:support:access",
  platformAuditView: "platform:audit:view",
  dashboardView: "dashboard:view",
  companiesManage: "companies:manage",
  brandingManage: "branding:manage",
  documentTemplatesManage: "documentTemplates:manage",
  branchesView: "branches:view",
  branchesManage: "branches:manage",
  branchesAccessAll: "branches:access_all",
  usersManage: "users:manage",
  rolesManage: "roles:manage",
  customersManage: "customers:manage",
  vendorsManage: "vendors:manage",
  shipmentsView: "shipments:view",
  shipmentsCreate: "shipments:create",
  shipmentsUpdate: "shipments:update",
  shipmentsDelete: "shipments:delete",
  shipmentsStatusUpdate: "shipments:status:update",
  shipmentsContainersManage: "shipments:containers:manage",
  shipmentsViewAssigned: "shipments:view_assigned",
  shipmentWorkflowView: "shipmentWorkflow:view",
  shipmentWorkflowUpdate: "shipmentWorkflow:update",
  shipmentWorkflowAssign: "shipmentWorkflow:assign",
  shipmentWorkflowDelete: "shipmentWorkflow:delete",
  shipmentRequestsView: "shipmentRequests:view",
  shipmentRequestsCreate: "shipmentRequests:create",
  shipmentRequestsUpdate: "shipmentRequests:update",
  shipmentRequestsDelete: "shipmentRequests:delete",
  shipmentRequestsQuote: "shipmentRequests:quote",
  shipmentRequestsConvert: "shipmentRequests:convert",
  documentsView: "documents:view",
  documentsUpload: "documents:upload",
  documentsUpdate: "documents:update",
  documentsDelete: "documents:delete",
  documentsVerify: "documents:verify",
  documentsDownload: "documents:download",
  documentsManage: "documents:manage",
  quotationsView: "quotations:view",
  quotationsCreate: "quotations:create",
  quotationsUpdate: "quotations:update",
  quotationsDelete: "quotations:delete",
  quotationsApprove: "quotations:approve",
  quotationsConvert: "quotations:convert",
  costingView: "costing:view",
  costingUpdate: "costing:update",
  costingDelete: "costing:delete",
  invoicesView: "invoices:view",
  invoicesCreate: "invoices:create",
  invoicesUpdate: "invoices:update",
  invoicesDelete: "invoices:delete",
  invoicesSend: "invoices:send",
  vendorBillsView: "vendorBills:view",
  vendorBillsCreate: "vendorBills:create",
  vendorBillsUpdate: "vendorBills:update",
  vendorBillsDelete: "vendorBills:delete",
  vendorBillsApprove: "vendorBills:approve",
  paymentsView: "payments:view",
  paymentsCreate: "payments:create",
  paymentsUpdate: "payments:update",
  paymentsDelete: "payments:delete",
  paymentsApprove: "payments:approve",
  approvalPoliciesManage: "approvalPolicies:manage",
  receivablesView: "receivables:view",
  payablesView: "payables:view",
  ledgersView: "ledgers:view",
  accountsManage: "accounts:manage",
  salesManage: "sales:manage",
  reportsView: "reports:view",
  reportsFinancial: "reports:financial",
  reportsOperations: "reports:operations",
  reportsExport: "reports:export",
  reportsAccounting: "reports:accounting",
  companiesSwitch: "companies:switch",
  tasksList: "tasks:list",
  tasksView: "tasks:view",
  tasksCreate: "tasks:create",
  tasksEdit: "tasks:edit",
  tasksDelete: "tasks:delete",
  tasksComment: "tasks:comment",
  tasksAssign: "tasks:assign",
  carrierQueriesList: "carrierQueries:list",
  carrierQueriesView: "carrierQueries:view",
  carrierQueriesCreate: "carrierQueries:create",
  carrierQueriesEdit: "carrierQueries:edit",
  carrierQueriesDelete: "carrierQueries:delete",
  carrierProposalsView: "carrierProposals:view",
  carrierProposalsManage: "carrierProposals:manage",
  carrierProposalsSelect: "carrierProposals:select",
  bookingsView: "bookings:view",
  bookingsManage: "bookings:manage",
  shippingInstructionsView: "shippingInstructions:view",
  shippingInstructionsManage: "shippingInstructions:manage",
  billOfLadingView: "billOfLading:view",
  billOfLadingManage: "billOfLading:manage",
  billOfLadingLock: "billOfLading:lock",
  preAlertsView: "preAlerts:view",
  preAlertsManage: "preAlerts:manage",
  preAlertsSend: "preAlerts:send",
  releaseChecksView: "releaseChecks:view",
  releaseChecksManage: "releaseChecks:manage",
  exportsPrint: "exports:print",
  exportsPdf: "exports:pdf",
  exportsCsv: "exports:csv",
  importsCsv: "imports:csv",
  notificationsView: "notifications:view",
  notificationsUpdate: "notifications:update",
  notificationsDelete: "notifications:delete",
  notificationTemplatesView: "notificationTemplates:view",
  notificationTemplatesManage: "notificationTemplates:manage",
  notificationDeliveriesView: "notificationDeliveries:view",
  notificationDeliveriesManage: "notificationDeliveries:manage",
  communicationAccountsView: "communicationAccounts:view",
  communicationAccountsManage: "communicationAccounts:manage",
  communicationAccountsConnect: "communicationAccounts:connect",
  communicationAccountsTest: "communicationAccounts:test",
  communicationAccountsSend: "communicationAccounts:send",
  shareView: "share:view",
  shareCreate: "share:create",
  shareSend: "share:send",
  auditLogsView: "audit_logs:view",
  clientPortalView: "client_portal:view",
  clientPortalAccountsView: "clientPortalAccounts:view",
  clientPortalAccountsCreate: "clientPortalAccounts:create",
  clientPortalAccountsUpdate: "clientPortalAccounts:update",
  clientPortalAccountsDelete: "clientPortalAccounts:delete",
  clientPortalAccountsResetPassword: "clientPortalAccounts:resetPassword",
  aiUse: "ai:use",
  aiConfigure: "ai:configure",
} as const;

export type PermissionKey = (typeof permissions)[keyof typeof permissions];

export function hasPermission(
  user: { permissions?: string[]; roles?: string[] } | null | undefined,
  permission: PermissionKey,
) {
  if (!user) return false;
  return Boolean(user.permissions?.includes(permission));
}

export function hasRole(
  user: { roles?: string[] } | null | undefined,
  role: string,
) {
  return Boolean(user?.roles?.includes(role));
}

export async function requirePermission(permission: PermissionKey) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!hasPermission(user, permission)) {
    redirect("/dashboard?access=denied");
  }

  return user;
}

export async function requirePlatformPermission(permission: PermissionKey) {
  const user = await requirePermission(permission);

  if (user.scope !== "PLATFORM") {
    redirect("/platform-login?error=wrong-portal");
  }

  return user;
}

export async function requireUserScope(scope: "PLATFORM" | "COMPANY" | "CLIENT") {
  const user = await getCurrentUser();

  if (!user) {
    redirect(scope === "PLATFORM" ? "/platform-login" : scope === "CLIENT" ? "/portal-login" : "/login");
  }

  if (user.scope !== scope) {
    redirect(scope === "PLATFORM" ? "/platform-login?error=wrong-portal" : scope === "CLIENT" ? "/portal-login?error=wrong-portal" : "/login?error=wrong-portal");
  }

  return user;
}

export async function requireCompanyAccess(companyId: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.scope !== "COMPANY" || user.companyId !== companyId) {
    redirect("/dashboard?access=denied");
  }

  return user;
}
