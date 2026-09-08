import { createPayment } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { requireBillingPage } from "@/lib/billing/page-helpers";
import { PaymentForm } from "@/components/forms/billing-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewReceivedPaymentPage() {
  const { companyId, branchWhere } = await requireBillingPage("payments:create");
  const [customers, shipments, invoices] = await Promise.all([
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({ where: { companyId, deletedAt: null, ...branchWhere }, orderBy: { createdAt: "desc" }, select: { id: true, jobNo: true } }),
    prisma.invoice.findMany({ where: { companyId, deletedAt: null, ...branchWhere, dueAmount: { gt: 0 }, status: { not: "CANCELLED" } }, orderBy: { invoiceDate: "desc" }, select: { id: true, invoiceNo: true, customerId: true, dueAmount: true } }),
  ]);
  const invoiceOptions = invoices.map((invoice) => ({
    ...invoice,
    dueAmount: invoice.dueAmount.toString(),
  }));
  return <main className="p-4 lg:p-6"><Card><CardHeader><CardTitle>Receive customer payment</CardTitle></CardHeader><CardContent><PaymentForm action={createPayment} direction="RECEIVED" customers={customers} vendors={[]} shipments={shipments} invoices={invoiceOptions} vendorBills={[]} /></CardContent></Card></main>;
}
