import { createPayment } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { requireBillingPage } from "@/lib/billing/page-helpers";
import { PaymentForm } from "@/components/forms/billing-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewPaidPaymentPage() {
  const { companyId, branchWhere } = await requireBillingPage("payments:create");
  const [vendors, shipments, vendorBills] = await Promise.all([
    prisma.vendor.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({ where: { companyId, deletedAt: null, ...branchWhere }, orderBy: { createdAt: "desc" }, select: { id: true, jobNo: true } }),
    prisma.vendorbill.findMany({ where: { companyId, deletedAt: null, ...branchWhere, dueAmount: { gt: 0 }, status: { not: "CANCELLED" } }, orderBy: { billDate: "desc" }, select: { id: true, billNo: true, vendorId: true, dueAmount: true } }),
  ]);
  const vendorBillOptions = vendorBills.map((bill) => ({
    ...bill,
    dueAmount: bill.dueAmount.toString(),
  }));
  return <main className="p-4 lg:p-6"><Card><CardHeader><CardTitle>Pay vendor</CardTitle></CardHeader><CardContent><PaymentForm action={createPayment} direction="PAID" customers={[]} vendors={vendors} shipments={shipments} invoices={[]} vendorBills={vendorBillOptions} /></CardContent></Card></main>;
}
