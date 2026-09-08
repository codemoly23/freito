import type { QuotationExportData } from "@/lib/print/data";
import { formatDate, formatMoney, formatValue } from "@/lib/pdf/formatters";
import { generatePdf, type PdfSection } from "@/lib/pdf/pdf-generator";
import { resolveCustomNoteText, resolveSectionOrder, type ResolvedDocumentLayout } from "@/lib/document-templates/sections";
import { QUOTATION_SECTION_KEYS, type QuotationSectionKey } from "@/lib/validators/document-templates";

export function generateQuotationPdf(quotation: QuotationExportData, layout?: ResolvedDocumentLayout<QuotationSectionKey> | null) {
  const defaultNote = quotation.remarks ?? "Rates are subject to the stated validity and operational availability.";
  const noteText = resolveCustomNoteText(layout, defaultNote, {
    companyName: quotation.company.legalName ?? quotation.company.name,
    customerName: quotation.customer.name,
    documentNo: quotation.quoteNo,
    documentDate: formatDate(quotation.createdAt),
  });

  const sectionMap: Record<QuotationSectionKey, PdfSection> = {
    "quotation-details": {
      title: "Quotation details",
      lines: [
        ["Date", formatDate(quotation.createdAt)],
        ["Valid until", formatDate(quotation.validUntil)],
        ["Customer", quotation.customer.name],
        ["Customer contact", [quotation.customer.email, quotation.customer.phone].filter(Boolean).join(" | ")],
        ["Reference", quotation.shipmentRequest?.customerReference ?? quotation.shipmentRequest?.requestNo ?? quotation.shipmentJob?.jobNo ?? "-"],
        ["Route", `${formatValue(quotation.originCountry)} / ${formatValue(quotation.originPort)} to ${formatValue(quotation.destinationCountry)} / ${formatValue(quotation.destinationPort)}`],
        ["Service", [quotation.shipmentType, quotation.transportMode, quotation.loadType, quotation.tradeTerm].filter(Boolean).join(" / ")],
      ],
    },
    cargo: { title: "Cargo", paragraphs: [quotation.cargoDescription ?? "-"] },
    charges: {
      title: "Charges",
      table: {
        columns: [
          { label: "Charge", width: 190 },
          { label: "Basis", width: 90 },
          { label: "Qty", width: 55, align: "right" },
          { label: "Rate", width: 90, align: "right" },
          { label: "Amount", width: 90, align: "right" },
        ],
        rows: quotation.charges.map((charge) => [
          charge.chargeName,
          `${charge.chargeType} / ${charge.chargeBasis}`,
          formatValue(charge.quantity),
          formatMoney(charge.sellRate, charge.currency),
          formatMoney(charge.sellAmount, charge.currency),
        ]),
      },
    },
    total: {
      title: "Total",
      lines: [["Total sell amount", formatMoney(quotation.totalSellAmount)]],
    },
    notes: { title: "Customer notes and terms", paragraphs: [noteText] },
    "prepared-by": { title: "Prepared by", lines: [["Name", quotation.createdBy.name]] },
  };

  const order = resolveSectionOrder(QUOTATION_SECTION_KEYS, layout);

  return generatePdf({
    title: "QUOTATION",
    documentNo: quotation.quoteNo,
    status: quotation.status,
    companyName: quotation.company.legalName ?? quotation.company.name,
    companyDetails: [quotation.company.address ?? "", quotation.company.email ?? "", quotation.company.phone ?? ""],
    companyLogoPath: quotation.company.logoPath,
    sections: order.map((key) => sectionMap[key]),
  });
}
