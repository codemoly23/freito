import "server-only";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere } from "@/lib/access/branch-access";
import { hasPermission, type PermissionKey } from "@/lib/permissions/rbac";
import type { CsvColumn } from "@/lib/exports/csv";

export type ExportContext = {
  companyId: string;
  user: { id: string; permissions?: string[] };
  accessibleBranchIds: string[] | null;
};

export type ExportEntityConfig = {
  key: string;
  label: string;
  /** Entity's own view permission, required in addition to the blanket exports:csv gate. */
  permission: PermissionKey;
  branchScoped: boolean;
  fetch: (ctx: ExportContext) => Promise<Record<string, unknown>[]>;
  columns: (ctx: ExportContext) => CsvColumn<Record<string, unknown>>[];
};

function dateCell(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function decimalCell(value: { toString(): string } | null | undefined) {
  return value ? value.toString() : "";
}

const customerColumns: CsvColumn<Record<string, unknown>>[] = [
  { header: "Name", accessor: (r) => r.name as string },
  { header: "Code", accessor: (r) => r.code as string | null },
  { header: "Email", accessor: (r) => r.email as string | null },
  { header: "Phone", accessor: (r) => r.phone as string | null },
  { header: "Address", accessor: (r) => r.address as string | null },
  { header: "BIN/VAT", accessor: (r) => r.binOrVat as string | null },
  { header: "Status", accessor: (r) => r.status as string },
];

const vendorColumns: CsvColumn<Record<string, unknown>>[] = [
  { header: "Name", accessor: (r) => r.name as string },
  { header: "Type", accessor: (r) => r.type as string },
  { header: "Email", accessor: (r) => r.email as string | null },
  { header: "Phone", accessor: (r) => r.phone as string | null },
  { header: "Address", accessor: (r) => r.address as string | null },
  { header: "Payment Terms", accessor: (r) => r.paymentTerms as string | null },
  { header: "Status", accessor: (r) => r.status as string },
];

export const exportEntities: Record<string, ExportEntityConfig> = {
  customers: {
    key: "customers",
    label: "Customers",
    permission: "customers:manage",
    branchScoped: false,
    fetch: async ({ companyId }) =>
      prisma.customer.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" } }),
    columns: () => customerColumns,
  },
  vendors: {
    key: "vendors",
    label: "Vendors",
    permission: "vendors:manage",
    branchScoped: false,
    fetch: async ({ companyId }) =>
      prisma.vendor.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" } }),
    columns: () => vendorColumns,
  },
  shipments: {
    key: "shipments",
    label: "Shipments",
    permission: "shipments:view",
    branchScoped: true,
    fetch: async ({ companyId, accessibleBranchIds }) =>
      prisma.shipmentjob.findMany({
        where: { companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    columns: () => [
      { header: "Job No", accessor: (r) => r.jobNo as string },
      { header: "Customer", accessor: (r) => (r.customer as { name: string } | null)?.name },
      { header: "Shipment Type", accessor: (r) => r.shipmentType as string },
      { header: "Transport Mode", accessor: (r) => r.transportMode as string },
      { header: "Origin", accessor: (r) => [r.originPort, r.originCountry].filter(Boolean).join(", ") },
      { header: "Destination", accessor: (r) => [r.destinationPort, r.destinationCountry].filter(Boolean).join(", ") },
      { header: "Status", accessor: (r) => r.currentStatus as string | null },
      { header: "ETD", accessor: (r) => dateCell(r.etd as Date | null) },
      { header: "ETA", accessor: (r) => dateCell(r.eta as Date | null) },
    ],
  },
  quotations: {
    key: "quotations",
    label: "Quotations",
    permission: "quotations:view",
    branchScoped: true,
    fetch: async ({ companyId, accessibleBranchIds }) =>
      prisma.quotation.findMany({
        where: { companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    columns: ({ user }) => {
      const includeCosting = hasPermission(user, "costing:view");
      const base: CsvColumn<Record<string, unknown>>[] = [
        { header: "Quote No", accessor: (r) => r.quoteNo as string },
        { header: "Customer", accessor: (r) => (r.customer as { name: string } | null)?.name },
        { header: "Status", accessor: (r) => r.status as string },
        { header: "Origin", accessor: (r) => [r.originPort, r.originCountry].filter(Boolean).join(", ") },
        { header: "Destination", accessor: (r) => [r.destinationPort, r.destinationCountry].filter(Boolean).join(", ") },
        { header: "Sell Amount", accessor: (r) => decimalCell(r.totalSellAmount as { toString(): string } | null) },
      ];
      if (!includeCosting) return base;
      return [
        ...base,
        { header: "Buy Amount", accessor: (r) => decimalCell(r.totalBuyAmount as { toString(): string } | null) },
        { header: "Gross Profit", accessor: (r) => decimalCell(r.grossProfit as { toString(): string } | null) },
        { header: "Margin %", accessor: (r) => decimalCell(r.profitMarginPercent as { toString(): string } | null) },
      ];
    },
  },
  invoices: {
    key: "invoices",
    label: "Invoices",
    permission: "invoices:view",
    branchScoped: true,
    fetch: async ({ companyId, accessibleBranchIds }) =>
      prisma.invoice.findMany({
        where: { companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    columns: () => [
      { header: "Invoice No", accessor: (r) => r.invoiceNo as string },
      { header: "Customer", accessor: (r) => (r.customer as { name: string } | null)?.name },
      { header: "Status", accessor: (r) => r.status as string },
      { header: "Invoice Date", accessor: (r) => dateCell(r.invoiceDate as Date | null) },
      { header: "Due Date", accessor: (r) => dateCell(r.dueDate as Date | null) },
      { header: "Currency", accessor: (r) => r.currency as string },
      { header: "Total Amount", accessor: (r) => decimalCell(r.totalAmount as { toString(): string } | null) },
      { header: "Paid Amount", accessor: (r) => decimalCell(r.paidAmount as { toString(): string } | null) },
      { header: "Due Amount", accessor: (r) => decimalCell(r.dueAmount as { toString(): string } | null) },
    ],
  },
  "vendor-bills": {
    key: "vendor-bills",
    label: "Vendor Bills",
    permission: "vendorBills:view",
    branchScoped: true,
    fetch: async ({ companyId, accessibleBranchIds }) =>
      prisma.vendorbill.findMany({
        where: { companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    columns: () => [
      { header: "Bill No", accessor: (r) => r.billNo as string },
      { header: "Vendor", accessor: (r) => (r.vendor as { name: string } | null)?.name },
      { header: "Status", accessor: (r) => r.status as string },
      { header: "Bill Date", accessor: (r) => dateCell(r.billDate as Date | null) },
      { header: "Due Date", accessor: (r) => dateCell(r.dueDate as Date | null) },
      { header: "Currency", accessor: (r) => r.currency as string },
      { header: "Total Amount", accessor: (r) => decimalCell(r.totalAmount as { toString(): string } | null) },
      { header: "Paid Amount", accessor: (r) => decimalCell(r.paidAmount as { toString(): string } | null) },
      { header: "Due Amount", accessor: (r) => decimalCell(r.dueAmount as { toString(): string } | null) },
    ],
  },
  payments: {
    key: "payments",
    label: "Payments",
    permission: "payments:view",
    branchScoped: true,
    fetch: async ({ companyId, accessibleBranchIds }) =>
      prisma.payment.findMany({
        where: { companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
        include: { customer: { select: { name: true } }, vendor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    columns: () => [
      { header: "Payment No", accessor: (r) => r.paymentNo as string },
      { header: "Direction", accessor: (r) => r.direction as string },
      { header: "Party", accessor: (r) => (r.customer as { name: string } | null)?.name ?? (r.vendor as { name: string } | null)?.name },
      { header: "Status", accessor: (r) => r.status as string },
      { header: "Payment Date", accessor: (r) => dateCell(r.paymentDate as Date | null) },
      { header: "Method", accessor: (r) => r.paymentMethod as string },
      { header: "Currency", accessor: (r) => r.currency as string },
      { header: "Amount", accessor: (r) => decimalCell(r.amount as { toString(): string } | null) },
    ],
  },
  tasks: {
    key: "tasks",
    label: "Tasks",
    permission: "tasks:list",
    branchScoped: true,
    fetch: async ({ companyId, accessibleBranchIds }) =>
      prisma.task.findMany({
        where: { companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
        include: { user_task_assignedUserIdTouser: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    columns: () => [
      { header: "Title", accessor: (r) => r.title as string },
      { header: "Status", accessor: (r) => r.status as string },
      { header: "Priority", accessor: (r) => r.priority as string },
      { header: "Assigned To", accessor: (r) => (r.user_task_assignedUserIdTouser as { name: string } | null)?.name },
      { header: "Due Date", accessor: (r) => dateCell(r.dueDate as Date | null) },
    ],
  },
};
