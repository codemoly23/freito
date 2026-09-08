import Link from "next/link";
import { notFound } from "next/navigation";
import { updateInvoiceStatus } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { billingStatusVariant, getEffectiveInvoiceStatus, money, requireBillingPage } from "@/lib/billing/page-helpers";
import { hasPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareButton } from "@/components/share/share-button";
import { buildEmailShareUrl, buildInternalShareLink, buildWhatsAppShareUrl } from "@/lib/share/share-links";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, companyId, branchWhere } = await requireBillingPage("invoices:view");
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, companyId, deletedAt: null, ...branchWhere }, include: { company: { select: { portalSlug: true } }, customer: true, shipmentjob: { select: { jobNo: true } }, quotation: { select: { quoteNo: true } }, invoiceline: { where: { deletedAt: null } }, payment: { where: { deletedAt: null }, orderBy: { paymentDate: "desc" } } } });
  if (!invoice) notFound();
  const status = getEffectiveInvoiceStatus(invoice);
  const shareLink = buildInternalShareLink(invoice.company.portalSlug ? `/portal/${invoice.company.portalSlug}` : "/");
  const shareMessage = `Invoice ${invoice.invoiceNo} is available through your secure client portal: ${shareLink}`;
  return <main className="space-y-6 p-4 lg:p-6">
    <div className="flex justify-between gap-3"><div><Badge variant={billingStatusVariant(status)}>{status}</Badge><h1 className="mt-3 text-2xl font-semibold">{invoice.invoiceNo}</h1><p className="text-sm text-slate-500">{invoice.customer.name}</p></div><div className="flex flex-wrap gap-2">{hasPermission(user, "tasks:create") ? <Button asChild variant="outline"><Link href={`/dashboard/tasks/new?invoiceId=${invoice.id}&customerId=${invoice.customerId}&shipmentJobId=${invoice.shipmentJobId ?? ""}&quotationId=${invoice.quotationId ?? ""}&returnTo=/dashboard/invoices/${invoice.id}`}>Create Task</Link></Button> : null}{hasPermission(user, "share:view") ? <ShareButton resourceType="invoice" resourceId={invoice.id} whatsappUrl={buildWhatsAppShareUrl(invoice.customer.phone, shareMessage)} emailUrl={buildEmailShareUrl(invoice.customer.email, `Invoice ${invoice.invoiceNo}`, shareMessage)} internalLink={shareLink} printUrl={hasPermission(user, "exports:print") ? `/dashboard/invoices/${invoice.id}/print` : null} downloadUrl={hasPermission(user, "exports:pdf") ? `/api/invoices/${invoice.id}/pdf` : null} canCreateOutbox={hasPermission(user, "share:create")} /> : null}{hasPermission(user, "exports:print") ? <Button asChild variant="outline"><Link href={`/dashboard/invoices/${invoice.id}/print`}>Print</Link></Button> : null}{hasPermission(user, "exports:pdf") ? <Button asChild variant="outline"><a download href={`/api/invoices/${invoice.id}/pdf`}>Download PDF</a></Button> : null}{hasPermission(user, "invoices:update") ? <Button asChild variant="outline"><Link href={`/dashboard/invoices/${invoice.id}/edit`}>Edit</Link></Button> : null}{hasPermission(user, "invoices:send") && invoice.status === "DRAFT" ? <StatusForm id={invoice.id} status="SENT" label="Mark sent" /> : null}{hasPermission(user, "invoices:update") && !["PAID", "CANCELLED"].includes(invoice.status) ? <StatusForm id={invoice.id} status="CANCELLED" label="Cancel" /> : null}</div></div>
    <section className="grid gap-4 md:grid-cols-3"><Summary label="Total" value={money(invoice.totalAmount, invoice.currency)} /><Summary label="Paid" value={money(invoice.paidAmount, invoice.currency)} /><Summary label="Due" value={money(invoice.dueAmount, invoice.currency)} /></section>
    <Card><CardHeader><CardTitle>Invoice lines</CardTitle></CardHeader><CardContent><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Description</th><th className="p-3">Qty</th><th className="p-3">Unit price</th><th className="p-3">Amount</th></tr></thead><tbody>{(invoice.invoiceline ?? []).map((line) => <tr key={line.id} className="border-b"><td className="p-3">{line.description}</td><td className="p-3">{String(line.quantity)}</td><td className="p-3">{money(line.unitPrice, invoice.currency)}</td><td className="p-3">{money(line.amount, invoice.currency)}</td></tr>)}</tbody></table></CardContent></Card>
    <Card><CardHeader><CardTitle>Payments</CardTitle></CardHeader><CardContent className="space-y-2">{(invoice.payment ?? []).map((payment) => <div key={payment.id} className="flex justify-between rounded-md border p-3 text-sm"><span>{payment.paymentNo} · {payment.paymentDate.toLocaleDateString()}</span><span>{money(payment.amount, payment.currency)}</span></div>)}{!(invoice.payment ?? []).length ? <p className="text-sm text-slate-500">No payments recorded.</p> : null}</CardContent></Card>
  </main>;
}

function StatusForm({ id, status, label }: { id: string; status: string; label: string }) {
  return <form action={updateInvoiceStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><Button type="submit" variant="outline">{label}</Button></form>;
}
function Summary({ label, value }: { label: string; value: string }) { return <Card><CardContent className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></CardContent></Card>; }
