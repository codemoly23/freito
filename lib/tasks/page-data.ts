import { prisma } from "@/lib/db/prisma";

export async function getTaskFormOptions(companyId: string) {
  const [users, customers, vendors, shipments, quotations, invoices, requests] = await Promise.all([
    prisma.user.findMany({ where: { companyId, scope: "COMPANY", status: "ACTIVE", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.vendor.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, jobNo: true } }),
    prisma.quotation.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, quoteNo: true } }),
    prisma.invoice.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, invoiceNo: true } }),
    prisma.shipmentrequest.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, requestNo: true } }),
  ]);
  return {
    users: users.map((item) => ({ id: item.id, label: item.name ?? item.email })),
    customers: customers.map((item) => ({ id: item.id, label: item.name })),
    vendors: vendors.map((item) => ({ id: item.id, label: item.name })),
    shipments: shipments.map((item) => ({ id: item.id, label: item.jobNo })),
    quotations: quotations.map((item) => ({ id: item.id, label: item.quoteNo })),
    invoices: invoices.map((item) => ({ id: item.id, label: item.invoiceNo })),
    requests: requests.map((item) => ({ id: item.id, label: item.requestNo })),
  };
}
