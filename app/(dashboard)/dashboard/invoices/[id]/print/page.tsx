import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDetails, PrintLayout, PrintSection, PrintTable } from "@/components/print/print-layout";
import { requireModuleAccess } from "@/lib/access/company-access";
import { formatDate, formatMoney } from "@/lib/pdf/formatters";
import { requirePermission } from "@/lib/permissions/rbac";
import { getInvoiceExportData } from "@/lib/print/data";

export const metadata: Metadata = { title: "Print Invoice" };

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("exports:print");
  await requireModuleAccess(user.companyId, "BILLING");
  const { id } = await params;
  const invoice = await getInvoiceExportData(id, user.companyId ?? "");
  if (!invoice) notFound();
  return <PrintLayout title="Invoice" documentNo={invoice.invoiceNo} status={invoice.status} company={invoice.company} logoUrl={invoice.company.logoPath ? "/api/company/branding/logo" : null} pdfUrl={`/api/invoices/${invoice.id}/pdf`}>
    <PrintSection title="Invoice details"><PrintDetails items={[
      ["Invoice date", formatDate(invoice.invoiceDate)],
      ["Due date", formatDate(invoice.dueDate)],
      ["Bill to", invoice.customer.name],
      ["Billing address", invoice.customer.address ?? "-"],
      ["Contact", [invoice.customer.email, invoice.customer.phone].filter(Boolean).join(" | ")],
      ["BIN / VAT", invoice.customer.binOrVat ?? "-"],
      ["Shipment / job", invoice.shipmentJob?.jobNo ?? "-"],
      ["Quotation", invoice.quotation?.quoteNo ?? "-"],
    ]} /></PrintSection>
    <PrintSection title="Line items"><PrintTable headers={["Description", "Quantity", "Unit price", "Amount"]} rows={invoice.lines.map((line) => [
      line.description,
      String(line.quantity),
      formatMoney(line.unitPrice, invoice.currency),
      formatMoney(line.amount, invoice.currency),
    ])} /></PrintSection>
    <PrintSection title="Totals"><PrintDetails items={[
      ["Subtotal", formatMoney(invoice.subtotal, invoice.currency)],
      ["Discount", formatMoney(invoice.discountAmount, invoice.currency)],
      ["Tax", formatMoney(invoice.taxAmount, invoice.currency)],
      ["Grand total", formatMoney(invoice.totalAmount, invoice.currency)],
      ["Paid amount", formatMoney(invoice.paidAmount, invoice.currency)],
      ["Due amount", formatMoney(invoice.dueAmount, invoice.currency)],
    ]} /></PrintSection>
    <PrintSection title="Payment instructions / notes"><p className="whitespace-pre-wrap text-sm">{invoice.remarks ?? "Please reference the invoice number when arranging payment."}</p></PrintSection>
  </PrintLayout>;
}
