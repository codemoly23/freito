import { prisma } from "@/lib/db/prisma";
import { parseDocumentTemplateLayout } from "@/lib/document-templates/sections";
/**
 * The company's most recently created real freight document of one of the
 * 4 templatable types (HBL/HAWB/DEBIT_NOTE/MANIFEST), used only to build a
 * "Preview" link into that document's own print page -- there is no PDFKit
 * generator for these types the way Quotation/Invoice have, so preview
 * reuses the real print page instead of rendering a standalone PDF.
 */
export async function findSampleFreightDocumentForType(
  companyId: string,
  documentType: "HBL" | "HAWB" | "DEBIT_NOTE" | "MANIFEST",
) {
  return prisma.freightdocument.findFirst({
    where: { companyId, type: documentType, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, shipmentJobId: true },
  });
}

export async function listDocumentTemplates(companyId: string) {
  return prisma.documenttemplate.findMany({
    where: { companyId, deletedAt: null },
    orderBy: [{ documentType: "asc" }, { createdAt: "asc" }],
    select: { id: true, documentType: true, name: true, isActive: true, updatedAt: true },
  });
}

export async function getDocumentTemplateWithCurrentVersion(companyId: string, templateId: string) {
  const template = await prisma.documenttemplate.findFirst({
    where: { id: templateId, companyId, deletedAt: null },
    select: {
      id: true,
      documentType: true,
      name: true,
      isActive: true,
      documenttemplateversion: {
        where: { isCurrent: true },
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { id: true, versionNumber: true, layoutJson: true },
      },
    },
  });
  if (!template) return null;

  const currentVersion = template.documenttemplateversion[0] ?? null;
  const layout = currentVersion ? parseDocumentTemplateLayout(template.documentType, currentVersion.layoutJson) : null;

  return { id: template.id, documentType: template.documentType, name: template.name, isActive: template.isActive, currentVersion, layout };
}
