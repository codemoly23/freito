import { saveVendorBill } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { requireBillingPage } from "@/lib/billing/page-helpers";
import { VendorBillForm } from "@/components/forms/billing-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewVendorBillPage() {
  const { companyId, branchWhere } = await requireBillingPage("vendorBills:create");
  const [vendors, shipments] = await Promise.all([
    prisma.vendor.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({ where: { companyId, deletedAt: null, ...branchWhere }, orderBy: { createdAt: "desc" }, select: { id: true, jobNo: true } }),
  ]);
  return <main className="p-4 lg:p-6"><Card><CardHeader><CardTitle>Create vendor bill</CardTitle></CardHeader><CardContent><VendorBillForm action={saveVendorBill} vendors={vendors} shipments={shipments} /></CardContent></Card></main>;
}
