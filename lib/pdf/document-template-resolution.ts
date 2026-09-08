import { prisma } from "@/lib/db/prisma";
import { parseDocumentTemplateLayout, type ResolvedDocumentLayout } from "@/lib/document-templates/sections";
import type { DocumentTemplateType, InvoiceSectionKey, QuotationSectionKey } from "@/lib/validators/document-templates";

async function resolveActiveVersion(companyId: string, documentType: DocumentTemplateType) {
  const template = await prisma.documenttemplate.findFirst({
    where: { companyId, documentType, isActive: true, deletedAt: null },
    select: {
      documenttemplateversion: {
        where: { isCurrent: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true, layoutJson: true },
      },
    },
  });
  return template?.documenttemplateversion[0] ?? null;
}

/**
 * Resolves the layout to render a quotation/invoice PDF with.
 *
 * If the record already has a stamped `templateVersionId` (a prior PDF
 * generation locked one in), that exact version is always reused -- this is
 * what keeps an already-issued document reproducible even after the company
 * edits or deactivates its template later. Otherwise, the company's current
 * active template version is resolved and stamped onto the record for next
 * time. With no active template (or an invalid/vanished one), this returns
 * `null`, which callers must treat as "render the unchanged system default."
 */
async function resolveTemplateLayout<K extends string>(
  documentType: DocumentTemplateType,
  companyId: string,
  existingTemplateVersionId: string | null,
  stamp: (versionId: string) => Promise<unknown>,
): Promise<ResolvedDocumentLayout<K> | null> {
  if (existingTemplateVersionId) {
    const version = await prisma.documenttemplateversion.findUnique({
      where: { id: existingTemplateVersionId },
      select: { layoutJson: true },
    });
    return version ? (parseDocumentTemplateLayout(documentType, version.layoutJson) as ResolvedDocumentLayout<K> | null) : null;
  }

  const version = await resolveActiveVersion(companyId, documentType);
  if (!version) return null;

  const parsed = parseDocumentTemplateLayout(documentType, version.layoutJson) as ResolvedDocumentLayout<K> | null;
  if (!parsed) return null;

  await stamp(version.id).catch(() => {});
  return parsed;
}

export function resolveQuotationTemplateLayout(quotationId: string, companyId: string, existingTemplateVersionId: string | null) {
  return resolveTemplateLayout<QuotationSectionKey>("QUOTATION", companyId, existingTemplateVersionId, (versionId) =>
    prisma.quotation.update({ where: { id: quotationId }, data: { templateVersionId: versionId } }),
  );
}

export function resolveInvoiceTemplateLayout(invoiceId: string, companyId: string, existingTemplateVersionId: string | null) {
  return resolveTemplateLayout<InvoiceSectionKey>("INVOICE", companyId, existingTemplateVersionId, (versionId) =>
    prisma.invoice.update({ where: { id: invoiceId }, data: { templateVersionId: versionId } }),
  );
}

/**
 * Same resolution/lock-in contract as the Quotation/Invoice helpers above,
 * for the freight document types that have a dedicated print layout (HBL,
 * HAWB, DEBIT_NOTE, MANIFEST). The "lock point" here is first *print-page
 * view* rather than a PDF-generation server action, since freight documents
 * are rendered live and saved to PDF via the browser's own print dialog --
 * there is no separate generation step to hook into.
 */
export function resolveFreightDocumentTemplateLayout<K extends string>(
  documentType: DocumentTemplateType,
  freightDocumentId: string,
  companyId: string,
  existingTemplateVersionId: string | null,
) {
  return resolveTemplateLayout<K>(documentType, companyId, existingTemplateVersionId, (versionId) =>
    prisma.freightdocument.update({ where: { id: freightDocumentId }, data: { templateVersionId: versionId } }),
  );
}

/**
 * Loads a specific saved template version's layout directly by id, bypassing
 * the "must be the active version" resolution above and never stamping
 * anything -- used only by the settings-side preview flow so an admin can
 * see an in-progress (not yet activated) layout before committing to it.
 */
export async function loadTemplateVersionLayoutForPreview<K extends string>(
  documentType: DocumentTemplateType,
  templateId: string,
  companyId: string,
): Promise<ResolvedDocumentLayout<K> | null> {
  const template = await prisma.documenttemplate.findFirst({
    where: { id: templateId, companyId, documentType, deletedAt: null },
    select: {
      documenttemplateversion: {
        where: { isCurrent: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { layoutJson: true },
      },
    },
  });
  const version = template?.documenttemplateversion[0];
  if (!version) return null;
  return parseDocumentTemplateLayout(documentType, version.layoutJson) as ResolvedDocumentLayout<K> | null;
}
