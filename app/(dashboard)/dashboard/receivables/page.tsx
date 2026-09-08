import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { billingStatusVariant, getEffectiveInvoiceStatus, money, requireBillingPage } from "@/lib/billing/page-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ReceivablesPage() {
  const { companyId, branchWhere } = await requireBillingPage("receivables:view");
  const invoices = await prisma.invoice.findMany({ where: { companyId, deletedAt: null, dueAmount: { gt: 0 }, status: { not: "CANCELLED" }, ...branchWhere }, include: { customer: { select: { name: true } } }, orderBy: [{ dueDate: "asc" }, { invoiceDate: "asc" }] });
  const total = invoices.reduce((sum, invoice) => sum + Number(invoice.dueAmount) * Number(invoice.exchangeRateToBDT), 0);
  return <main className="space-y-6 p-4 lg:p-6"><div><Badge variant="secondary">Phase 6</Badge><h1 className="mt-3 text-2xl font-semibold">Receivables</h1><p className="text-sm text-slate-500">Outstanding customer invoices. BDT equivalent due: {money(total)}</p></div><Card><CardHeader><CardTitle>Open invoices</CardTitle></CardHeader><CardContent><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Invoice</th><th className="p-3">Customer</th><th className="p-3">Due date</th><th className="p-3">Outstanding</th><th className="p-3"></th></tr></thead><tbody>{invoices.map((invoice) => {
    const status = getEffectiveInvoiceStatus(invoice);
    return <tr key={invoice.id} className="border-b"><td className="p-3">{invoice.invoiceNo}<div><Badge variant={billingStatusVariant(status)}>{status}</Badge></div></td><td className="p-3">{invoice.customer.name}</td><td className="p-3">{invoice.dueDate?.toLocaleDateString() ?? "-"}</td><td className="p-3">{money(invoice.dueAmount, invoice.currency)}</td><td className="p-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/invoices/${invoice.id}`}>View</Link></Button></td></tr>;
  })}</tbody></table></CardContent></Card></main>;
}
