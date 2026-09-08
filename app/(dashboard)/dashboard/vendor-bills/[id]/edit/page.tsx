import { notFound } from "next/navigation";
import { saveVendorBill } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { requireBillingPage } from "@/lib/billing/page-helpers";
import { VendorBillForm } from "@/components/forms/billing-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditVendorBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { companyId, branchWhere } = await requireBillingPage("vendorBills:update");
  const { id } = await params;
  const bill = await prisma.vendorbill.findFirst({ where: { id, companyId, deletedAt: null, ...branchWhere }, include: { vendorbillline: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } } });
  if (!bill) notFound();
  if (["PAID", "CANCELLED"].includes(bill.status)) return <main className="p-6"><Card><CardContent className="p-6">Paid or cancelled bills cannot be edited.</CardContent></Card></main>;
  const [vendors, shipments] = await Promise.all([
    prisma.vendor.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({ where: { companyId, deletedAt: null, ...branchWhere }, orderBy: { createdAt: "desc" }, select: { id: true, jobNo: true } }),
  ]);
  return <main className="p-4 lg:p-6"><Card><CardHeader><CardTitle>Edit {bill.billNo}</CardTitle></CardHeader><CardContent><VendorBillForm action={saveVendorBill} bill={JSON.parse(JSON.stringify(bill))} vendors={vendors} shipments={shipments} /></CardContent></Card></main>;
}
