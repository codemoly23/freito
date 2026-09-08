"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { SECTION_KEYS_BY_TYPE } from "@/lib/document-templates/sections";
import {
  type DocumentTemplateType,
  documentTemplateLayoutSchemas,
  documentTemplateNameSchema,
  isDocumentTemplateType,
} from "@/lib/validators/document-templates";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

const PATH = "/dashboard/settings/document-templates";

function defaultLayoutJson(documentType: DocumentTemplateType) {
  return JSON.stringify({ sections: { order: [...SECTION_KEYS_BY_TYPE[documentType]], hidden: [] } });
}

export async function createDocumentTemplate(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documentTemplates:manage");

  const documentTypeRaw = getString(formData, "documentType");
  if (!isDocumentTemplateType(documentTypeRaw)) {
    return validationError("Unknown document type.");
  }
  const nameParsed = documentTemplateNameSchema.safeParse(getString(formData, "name"));
  if (!nameParsed.success) {
    return validationError("Please enter a template name.", { name: nameParsed.error.flatten().formErrors });
  }

  const template = await prisma.$transaction(async (tx) => {
    const created = await tx.documenttemplate.create({
      data: {
        id: crypto.randomUUID(),
        companyId,
        documentType: documentTypeRaw,
        name: nameParsed.data,
        createdById: user.id,
        updatedAt: new Date(),
      },
    });
    await tx.documenttemplateversion.create({
      data: {
        id: crypto.randomUUID(),
        templateId: created.id,
        versionNumber: 1,
        layoutJson: defaultLayoutJson(documentTypeRaw),
        isCurrent: true,
        createdById: user.id,
      },
    });
    return created;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "documenttemplate.created",
    entityType: "DocumentTemplate",
    entityId: template.id,
    metadata: { documentType: documentTypeRaw, name: template.name },
  });

  revalidatePath(PATH);
  return successState("Template created.");
}

async function loadOwnedTemplate(companyId: string, templateId: string) {
  return prisma.documenttemplate.findFirst({
    where: { id: templateId, companyId, deletedAt: null },
  });
}

export async function saveDocumentTemplateVersion(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("documentTemplates:manage");

  const templateId = getString(formData, "templateId");
  const template = await loadOwnedTemplate(companyId, templateId);
  if (!template) return validationError("Template was not found or you don't have access to it.");

  let orderRaw: unknown;
  let hiddenRaw: unknown;
  try {
    orderRaw = JSON.parse(getString(formData, "order") || "[]");
    hiddenRaw = JSON.parse(getString(formData, "hidden") || "[]");
  } catch {
    return validationError("This layout could not be saved.");
  }
  const customNoteText = getString(formData, "customNoteText").trim();

  const schema = documentTemplateLayoutSchemas[template.documentType];
  const parsed = schema.safeParse({
    sections: { order: orderRaw, hidden: hiddenRaw },
    ...(customNoteText ? { customNoteText } : {}),
  });
  if (!parsed.success) return validationError("This layout could not be saved.");

  await prisma.$transaction(async (tx) => {
    const latest = await tx.documenttemplateversion.findFirst({
      where: { templateId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    await tx.documenttemplateversion.updateMany({
      where: { templateId, isCurrent: true },
      data: { isCurrent: false },
    });
    await tx.documenttemplateversion.create({
      data: {
        id: crypto.randomUUID(),
        templateId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        layoutJson: JSON.stringify(parsed.data),
        isCurrent: true,
        createdById: user.id,
      },
    });
    await tx.documenttemplate.update({ where: { id: templateId }, data: { updatedAt: new Date() } });
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "documenttemplate.version_saved",
    entityType: "DocumentTemplate",
    entityId: templateId,
    metadata: { documentType: template.documentType },
  });

  revalidatePath(PATH);
  revalidatePath(`${PATH}/${templateId}`);
  return successState("Layout saved.");
}

export async function activateDocumentTemplate(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documentTemplates:manage");
  const templateId = getString(formData, "id");
  const template = await loadOwnedTemplate(companyId, templateId);
  if (!template) return;

  await prisma.$transaction([
    prisma.documenttemplate.updateMany({
      where: { companyId, documentType: template.documentType, isActive: true, deletedAt: null, id: { not: templateId } },
      data: { isActive: false },
    }),
    prisma.documenttemplate.update({ where: { id: templateId }, data: { isActive: true } }),
  ]);

  await audit({
    companyId,
    actorId: user.id,
    action: "documenttemplate.activated",
    entityType: "DocumentTemplate",
    entityId: templateId,
    metadata: { documentType: template.documentType, name: template.name },
  });

  revalidatePath(PATH);
}

export async function deactivateDocumentTemplate(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documentTemplates:manage");
  const templateId = getString(formData, "id");
  const template = await loadOwnedTemplate(companyId, templateId);
  if (!template) return;

  await prisma.documenttemplate.update({ where: { id: templateId }, data: { isActive: false } });

  await audit({
    companyId,
    actorId: user.id,
    action: "documenttemplate.deactivated",
    entityType: "DocumentTemplate",
    entityId: templateId,
    metadata: { documentType: template.documentType, name: template.name },
  });

  revalidatePath(PATH);
}

export async function duplicateDocumentTemplate(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documentTemplates:manage");
  const templateId = getString(formData, "id");
  const template = await loadOwnedTemplate(companyId, templateId);
  if (!template) return;

  const currentVersion = await prisma.documenttemplateversion.findFirst({
    where: { templateId, isCurrent: true },
    select: { layoutJson: true },
  });

  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.documenttemplate.create({
      data: {
        id: crypto.randomUUID(),
        companyId,
        documentType: template.documentType,
        name: `${template.name} (copy)`,
        createdById: user.id,
        updatedAt: new Date(),
      },
    });
    await tx.documenttemplateversion.create({
      data: {
        id: crypto.randomUUID(),
        templateId: created.id,
        versionNumber: 1,
        layoutJson: currentVersion?.layoutJson ?? defaultLayoutJson(template.documentType),
        isCurrent: true,
        createdById: user.id,
      },
    });
    return created;
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "documenttemplate.duplicated",
    entityType: "DocumentTemplate",
    entityId: copy.id,
    metadata: { documentType: template.documentType, sourceTemplateId: templateId },
  });

  revalidatePath(PATH);
}

export async function deleteDocumentTemplate(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("documentTemplates:manage");
  const templateId = getString(formData, "id");
  const template = await loadOwnedTemplate(companyId, templateId);
  if (!template) return;

  await prisma.documenttemplate.update({
    where: { id: templateId },
    data: { deletedAt: new Date(), isActive: false },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "documenttemplate.deleted",
    entityType: "DocumentTemplate",
    entityId: templateId,
    metadata: { documentType: template.documentType, name: template.name },
  });

  revalidatePath(PATH);
}
