import { notFound } from "next/navigation";
import { saveInvoice } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { requireBillingPage } from "@/lib/billing/page-helpers";
import { InvoiceForm } from "@/components/forms/billing-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { companyId, branchWhere } = await requireBillingPage("invoices:update");
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({ where: { id, companyId, deletedAt: null, ...branchWhere }, include: { invoiceline: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } } } });
  if (!invoice) notFound();
  if (["PAID", "CANCELLED"].includes(invoice.status)) return <main className="p-6"><Card><CardContent className="p-6">Paid or cancelled invoices cannot be edited.</CardContent></Card></main>;
  const [customers, shipments, quotations] = await Promise.all([
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({ where: { companyId, deletedAt: null, ...branchWhere }, orderBy: { createdAt: "desc" }, select: { id: true, jobNo: true } }),
    prisma.quotation.findMany({ where: { companyId, deletedAt: null, ...branchWhere }, orderBy: { createdAt: "desc" }, select: { id: true, quoteNo: true } }),
  ]);
  return <main className="space-y-6 p-4 lg:p-6"><Card><CardHeader><CardTitle>Edit {invoice.invoiceNo}</CardTitle></CardHeader><CardContent><InvoiceForm action={saveInvoice} invoice={JSON.parse(JSON.stringify(invoice))} customers={customers} shipments={shipments} quotations={quotations} /></CardContent></Card></main>;
}
