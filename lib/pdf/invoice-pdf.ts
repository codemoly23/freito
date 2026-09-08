import type { InvoiceExportData } from "@/lib/print/data";
import { formatDate, formatMoney } from "@/lib/pdf/formatters";
import { generatePdf, type PdfSection } from "@/lib/pdf/pdf-generator";
import { resolveCustomNoteText, resolveSectionOrder, type ResolvedDocumentLayout } from "@/lib/document-templates/sections";
import { INVOICE_SECTION_KEYS, type InvoiceSectionKey } from "@/lib/validators/document-templates";

export function generateInvoicePdf(invoice: InvoiceExportData, layout?: ResolvedDocumentLayout<InvoiceSectionKey> | null) {
  const defaultNote = invoice.remarks ?? "Please reference the invoice number when arranging payment.";
  const noteText = resolveCustomNoteText(layout, defaultNote, {
    companyName: invoice.company.legalName ?? invoice.company.name,
    customerName: invoice.customer.name,
    documentNo: invoice.invoiceNo,
    documentDate: formatDate(invoice.invoiceDate),
  });

  const sectionMap: Record<InvoiceSectionKey, PdfSection> = {
    "invoice-details": {
      title: "Invoice details",
      lines: [
        ["Invoice date", formatDate(invoice.invoiceDate)],
        ["Due date", formatDate(invoice.dueDate)],
        ["Bill to", invoice.customer.name],
        ["Billing address", invoice.customer.address ?? "-"],
        ["Contact", [invoice.customer.email, invoice.customer.phone].filter(Boolean).join(" | ")],
        ["BIN / VAT", invoice.customer.binOrVat ?? "-"],
        ["Shipment / job", invoice.shipmentJob?.jobNo ?? "-"],
        ["Quotation", invoice.quotation?.quoteNo ?? "-"],
      ],
    },
    "line-items": {
      title: "Line items",
      table: {
        columns: [
          { label: "Description", width: 245 },
          { label: "Qty", width: 55, align: "right" },
          { label: "Unit price", width: 110, align: "right" },
          { label: "Amount", width: 110, align: "right" },
        ],
        rows: invoice.lines.map((line) => [
          line.description,
          String(line.quantity),
          formatMoney(line.unitPrice, invoice.currency),
          formatMoney(line.amount, invoice.currency),
        ]),
      },
    },
    totals: {
      title: "Totals",
      lines: [
        ["Subtotal", formatMoney(invoice.subtotal, invoice.currency)],
        ["Discount", formatMoney(invoice.discountAmount, invoice.currency)],
        ["Tax", formatMoney(invoice.taxAmount, invoice.currency)],
        ["Grand total", formatMoney(invoice.totalAmount, invoice.currency)],
        ["Paid amount", formatMoney(invoice.paidAmount, invoice.currency)],
        ["Due amount", formatMoney(invoice.dueAmount, invoice.currency)],
      ],
    },
    "payment-notes": { title: "Payment instructions / notes", paragraphs: [noteText] },
    "prepared-by": { title: "Prepared by", lines: [["Name", invoice.createdBy.name]] },
  };

  const order = resolveSectionOrder(INVOICE_SECTION_KEYS, layout);

  return generatePdf({
    title: "INVOICE",
    documentNo: invoice.invoiceNo,
    status: invoice.status,
    companyName: invoice.company.legalName ?? invoice.company.name,
    companyDetails: [invoice.company.address ?? "", invoice.company.email ?? "", invoice.company.phone ?? ""],
    companyLogoPath: invoice.company.logoPath,
    sections: order.map((key) => sectionMap[key]),
  });
}
