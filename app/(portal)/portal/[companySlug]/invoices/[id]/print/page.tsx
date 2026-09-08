import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDetails, PrintLayout, PrintSection, PrintTable } from "@/components/print/print-layout";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalInvoiceData } from "@/lib/client-portal/data";
import { formatDate, formatMoney } from "@/lib/pdf/formatters";

export const metadata: Metadata = { title: "Print Portal Invoice" };

export default async function PortalInvoicePrintPage({ params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const invoice = await getPortalInvoiceData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!invoice) notFound();
  return <PrintLayout title="Invoice" documentNo={invoice.invoiceNo} status={invoice.status} company={invoice.company} logoUrl={invoice.company.logoPath ? `/api/portal/${companySlug}/branding/logo` : null} pdfUrl={`/api/portal/${companySlug}/invoices/${invoice.id}/pdf`}>
    <PrintSection title="Invoice details"><PrintDetails items={[
      ["Invoice date", formatDate(invoice.invoiceDate)], ["Due date", formatDate(invoice.dueDate)], ["Bill to", invoice.customer.name],
      ["Billing address", invoice.customer.address ?? "-"], ["Shipment / job", invoice.shipmentJob?.jobNo ?? "-"], ["Quotation", invoice.quotation?.quoteNo ?? "-"],
    ]} /></PrintSection>
    <PrintSection title="Line items"><PrintTable headers={["Description", "Quantity", "Unit price", "Amount"]} rows={invoice.lines.map((line) => [line.description, String(line.quantity), formatMoney(line.unitPrice, invoice.currency), formatMoney(line.amount, invoice.currency)])} /></PrintSection>
    <PrintSection title="Totals"><PrintDetails items={[
      ["Subtotal", formatMoney(invoice.subtotal, invoice.currency)], ["Discount", formatMoney(invoice.discountAmount, invoice.currency)], ["Tax", formatMoney(invoice.taxAmount, invoice.currency)],
      ["Grand total", formatMoney(invoice.totalAmount, invoice.currency)], ["Paid amount", formatMoney(invoice.paidAmount, invoice.currency)], ["Due amount", formatMoney(invoice.dueAmount, invoice.currency)],
    ]} /></PrintSection>
  </PrintLayout>;
}
