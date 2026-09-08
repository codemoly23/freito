import Link from "next/link";
import { Plus } from "lucide-react";
import { deleteInvoice } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { billingStatusVariant, getEffectiveInvoiceStatus, money, requireBillingPage } from "@/lib/billing/page-helpers";
import { hasPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/forms/shipment-forms";

export default async function InvoicesPage() {
  const { user, companyId } = await requireBillingPage("invoices:view");
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const invoices = await prisma.invoice.findMany({
    where: { companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    include: { customer: { select: { name: true } }, shipmentjob: { select: { jobNo: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex items-start justify-between">
        <div><Badge variant="secondary">Phase 6</Badge><h1 className="mt-3 text-2xl font-semibold">Invoices</h1></div>
        <div className="flex gap-2">
          {hasPermission(user, "exports:csv") ? <Button asChild size="sm" variant="outline"><a download href="/api/exports/invoices">Download CSV</a></Button> : null}
          {hasPermission(user, "invoices:create") ? <Button asChild><Link href="/dashboard/invoices/new"><Plus className="h-4 w-4" />New invoice</Link></Button> : null}
        </div>
      </div>
      <Card><CardHeader><CardTitle>Customer invoices</CardTitle></CardHeader><CardContent><div className="overflow-x-auto rounded-md border">
        <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">Invoice</th><th className="p-3">Customer / Shipment</th><th className="p-3">Total</th><th className="p-3">Paid / Due</th><th className="p-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y">{invoices.map((invoice) => {
            const status = getEffectiveInvoiceStatus(invoice);
            return <tr key={invoice.id}><td className="p-3 font-medium">{invoice.invoiceNo}<div><Badge variant={billingStatusVariant(status)}>{status}</Badge></div></td><td className="p-3">{invoice.customer.name}<div className="text-xs text-slate-500">{invoice.shipmentjob?.jobNo ?? "-"}</div></td><td className="p-3">{money(invoice.totalAmount, invoice.currency)}</td><td className="p-3">{money(invoice.paidAmount, invoice.currency)} / {money(invoice.dueAmount, invoice.currency)}</td><td className="p-3"><div className="flex justify-end gap-2"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/invoices/${invoice.id}`}>View</Link></Button>{hasPermission(user, "invoices:update") ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/invoices/${invoice.id}/edit`}>Edit</Link></Button> : null}{hasPermission(user, "invoices:delete") ? <form action={deleteInvoice}><input type="hidden" name="id" value={invoice.id} /><ConfirmDeleteButton label="Delete" message={`Delete ${invoice.invoiceNo}?`} /></form> : null}</div></td></tr>;
          })}
          {!invoices.length ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">No invoices found.</td></tr> : null}</tbody></table>
      </div></CardContent></Card>
    </main>
  );
}
