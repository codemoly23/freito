import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalInvoiceData } from "@/lib/client-portal/data";
import { formatDate, formatMoney } from "@/lib/pdf/formatters";

export default async function PortalInvoiceDetailPage({ params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const invoice = await getPortalInvoiceData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!invoice) notFound();
  return <main className="min-h-screen bg-slate-50 p-5"><div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><Button asChild variant="outline"><Link href={`/portal/${companySlug}/invoices`}>Back to invoices</Link></Button><div className="flex gap-2"><Button asChild variant="outline"><Link href={`/portal/${companySlug}/invoices/${invoice.id}/print`}>Print</Link></Button><Button asChild><a download href={`/api/portal/${companySlug}/invoices/${invoice.id}/pdf`}>Download PDF</a></Button></div></div>
    <Card><CardHeader><div className="flex justify-between gap-3"><div><CardTitle>{invoice.invoiceNo}</CardTitle><p className="text-sm text-slate-500">Invoice date {formatDate(invoice.invoiceDate)} · Due {formatDate(invoice.dueDate)}</p></div><Badge variant="secondary">{invoice.status}</Badge></div></CardHeader><CardContent className="grid gap-4 text-sm md:grid-cols-3"><p>Shipment: {invoice.shipmentJob?.jobNo ?? "-"}</p><p>Total: {formatMoney(invoice.totalAmount, invoice.currency)}</p><p>Paid: {formatMoney(invoice.paidAmount, invoice.currency)}</p><p>Due: {formatMoney(invoice.dueAmount, invoice.currency)}</p></CardContent></Card>
    <Card><CardHeader><CardTitle>Line items</CardTitle></CardHeader><CardContent><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Description</th><th className="p-3">Quantity</th><th className="p-3">Unit price</th><th className="p-3">Amount</th></tr></thead><tbody>{invoice.lines.map((line, index) => <tr className="border-b" key={`${line.description}-${index}`}><td className="p-3">{line.description}</td><td className="p-3">{String(line.quantity)}</td><td className="p-3">{formatMoney(line.unitPrice, invoice.currency)}</td><td className="p-3">{formatMoney(line.amount, invoice.currency)}</td></tr>)}</tbody></table></CardContent></Card>
  </div></main>;
}
