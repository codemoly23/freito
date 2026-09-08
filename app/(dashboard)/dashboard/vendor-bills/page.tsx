import Link from "next/link";
import { Plus } from "lucide-react";
import { deleteVendorBill } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { billingStatusVariant, getEffectiveVendorBillStatus, money, requireBillingPage } from "@/lib/billing/page-helpers";
import { hasPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/forms/shipment-forms";

export default async function VendorBillsPage() {
  const { user, companyId, branchWhere } = await requireBillingPage("vendorBills:view");
  const bills = await prisma.vendorbill.findMany({ where: { companyId, deletedAt: null, ...branchWhere }, include: { vendor: { select: { name: true } }, shipmentjob: { select: { jobNo: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="space-y-6 p-4 lg:p-6"><div className="flex justify-between"><div><Badge variant="secondary">Phase 6</Badge><h1 className="mt-3 text-2xl font-semibold">Vendor Bills</h1></div><div className="flex gap-2">{hasPermission(user, "exports:csv") ? <Button asChild size="sm" variant="outline"><a download href="/api/exports/vendor-bills">Download CSV</a></Button> : null}{hasPermission(user, "vendorBills:create") ? <Button asChild><Link href="/dashboard/vendor-bills/new"><Plus className="h-4 w-4" />New bill</Link></Button> : null}</div></div>
    <Card><CardHeader><CardTitle>Payables documents</CardTitle></CardHeader><CardContent><div className="overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Bill</th><th className="p-3">Vendor / Shipment</th><th className="p-3">Total</th><th className="p-3">Paid / Due</th><th className="p-3 text-right">Actions</th></tr></thead><tbody className="divide-y">{bills.map((bill) => {
      const status = getEffectiveVendorBillStatus(bill);
      return <tr key={bill.id}><td className="p-3 font-medium">{bill.billNo}<div><Badge variant={billingStatusVariant(status)}>{status}</Badge></div></td><td className="p-3">{bill.vendor.name}<div className="text-xs text-slate-500">{bill.shipmentjob?.jobNo ?? "-"}</div></td><td className="p-3">{money(bill.totalAmount, bill.currency)}</td><td className="p-3">{money(bill.paidAmount, bill.currency)} / {money(bill.dueAmount, bill.currency)}</td><td className="p-3"><div className="flex justify-end gap-2"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/vendor-bills/${bill.id}`}>View</Link></Button>{hasPermission(user, "vendorBills:update") ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/vendor-bills/${bill.id}/edit`}>Edit</Link></Button> : null}{hasPermission(user, "vendorBills:delete") ? <form action={deleteVendorBill}><input type="hidden" name="id" value={bill.id} /><ConfirmDeleteButton label="Delete" message={`Delete ${bill.billNo}?`} /></form> : null}</div></td></tr>;
    })}{!bills.length ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">No vendor bills found.</td></tr> : null}</tbody></table></div></CardContent></Card></main>;
}
