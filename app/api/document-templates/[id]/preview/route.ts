import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { getInvoiceExportData, getQuotationExportData } from "@/lib/print/data";
import { generateQuotationPdf } from "@/lib/pdf/quotation-pdf";
import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { parseDocumentTemplateLayout, type ResolvedDocumentLayout } from "@/lib/document-templates/sections";
import type { InvoiceSectionKey, QuotationSectionKey } from "@/lib/validators/document-templates";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Renders the template's currently-saved version against the company's most
 * recent real quotation/invoice, purely for preview -- this never stamps
 * `templateVersionId` onto that sample document, unlike the real PDF routes.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requirePermission("documentTemplates:manage");
  if (user.scope !== "COMPANY" || !user.companyId) return new Response("Not found", { status: 404 });
  const companyId = user.companyId;
  const { id } = await params;

  const template = await prisma.documenttemplate.findFirst({
    where: { id, companyId, deletedAt: null },
    select: {
      documentType: true,
      documenttemplateversion: {
        where: { isCurrent: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { layoutJson: true },
      },
    },
  });
  if (!template) return new Response("Not found", { status: 404 });

  const currentVersion = template.documenttemplateversion[0];
  const layout = currentVersion ? parseDocumentTemplateLayout(template.documentType, currentVersion.layoutJson) : null;

  if (template.documentType === "QUOTATION") {
    const sample = await prisma.quotation.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!sample) return new Response("No quotation exists yet to preview this template with.", { status: 404 });
    const quotation = await getQuotationExportData(sample.id, companyId);
    if (!quotation) return new Response("Not found", { status: 404 });
    const pdf = await generateQuotationPdf(quotation, layout as ResolvedDocumentLayout<QuotationSectionKey> | null);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="preview-${quotation.quoteNo}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const sample = await prisma.invoice.findFirst({
    where: { companyId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!sample) return new Response("No invoice exists yet to preview this template with.", { status: 404 });
  const invoice = await getInvoiceExportData(sample.id, companyId);
  if (!invoice) return new Response("Not found", { status: 404 });
  const pdf = await generateInvoicePdf(invoice, layout as ResolvedDocumentLayout<InvoiceSectionKey> | null);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-${invoice.invoiceNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
