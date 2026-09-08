"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getScopedCompanyId, audit, type ActionState, successState, validationError, getString } from "@/lib/actions/helpers";
import { z } from "zod";

const documentMasterSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  code: z.string().min(2, "Code must be at least 2 characters").regex(/^[a-z0-9_]+$/, "Code must be lowercase alphanumeric with underscores"),
  owner: z.string().default("FORWARDER"),
  docCategory: z.string().default("Shipping"),
  media: z.string().default("COMMON"),
  transportMode: z.string().default("MULTIMODAL"),
  isOptional: z.boolean().default(false),
  isRequired: z.boolean().default(true),
  countryRestriction: z.string().nullable().optional(),
  incotermRestriction: z.string().nullable().optional(),
  lcRequired: z.boolean().default(false),
  ttRequired: z.boolean().default(false),
  hazardousCargo: z.boolean().default(false),
  perishableCargo: z.boolean().default(false),
  temperatureControlled: z.boolean().default(false),
  containerRequired: z.boolean().default(false),
  workflowStage: z.string().nullable().optional(),
  mandatoryBeforeJobClose: z.boolean().default(false),
  mandatoryBeforeInvoice: z.boolean().default(false),
  mandatoryBeforeDeliveryOrder: z.boolean().default(false),
  mandatoryBeforeFinanceClose: z.boolean().default(false),
  description: z.string().nullable().optional(),
  helpText: z.string().nullable().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

export async function saveDocumentMasterAction(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData
): Promise<ActionState> {
  const formData = maybeFormData || (stateOrFormData instanceof FormData ? stateOrFormData : undefined);
  if (!formData) return validationError("Form data was not received.");

  const { user, companyId } = await getScopedCompanyId("branding:manage"); // Admin scope

  const id = getString(formData, "id") || undefined;
  
  const parsed = documentMasterSchema.safeParse({
    id,
    name: getString(formData, "name"),
    code: getString(formData, "code")?.toLowerCase(),
    owner: getString(formData, "owner"),
    docCategory: getString(formData, "docCategory"),
    media: getString(formData, "media"),
    transportMode: getString(formData, "transportMode"),
    isOptional: formData.get("isOptional") === "true",
    isRequired: formData.get("isRequired") === "true",
    countryRestriction: getString(formData, "countryRestriction") || null,
    incotermRestriction: getString(formData, "incotermRestriction") || null,
    lcRequired: formData.get("lcRequired") === "true",
    ttRequired: formData.get("ttRequired") === "true",
    hazardousCargo: formData.get("hazardousCargo") === "true",
    perishableCargo: formData.get("perishableCargo") === "true",
    temperatureControlled: formData.get("temperatureControlled") === "true",
    containerRequired: formData.get("containerRequired") === "true",
    workflowStage: getString(formData, "workflowStage") || null,
    mandatoryBeforeJobClose: formData.get("mandatoryBeforeJobClose") === "true",
    mandatoryBeforeInvoice: formData.get("mandatoryBeforeInvoice") === "true",
    mandatoryBeforeDeliveryOrder: formData.get("mandatoryBeforeDeliveryOrder") === "true",
    mandatoryBeforeFinanceClose: formData.get("mandatoryBeforeFinanceClose") === "true",
    description: getString(formData, "description") || null,
    helpText: getString(formData, "helpText") || null,
    sortOrder: Number(getString(formData, "sortOrder") || "0"),
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) {
    return validationError("Validation failed. Please correct form fields.", parsed.error.flatten().fieldErrors);
  }

  const data = parsed.data;
  delete data.id;

  try {
    const item = id 
      ? await prisma.documentchecklistitem.update({
          where: { id },
          data: {
            ...data,
            companyId: companyId,
            category: (data.media === "IMPORT" ? "IMPORT" : data.media === "EXPORT" ? "EXPORT" : "COMMON"),
            updatedAt: new Date(),
          }
        })
      : await prisma.documentchecklistitem.create({
          data: {
            id: crypto.randomUUID(),
            ...data,
            companyId: companyId,
            category: (data.media === "IMPORT" ? "IMPORT" : data.media === "EXPORT" ? "EXPORT" : "COMMON"),
            updatedAt: new Date(),
          }
        });

    await audit({
      companyId,
      actorId: user.id,
      action: id ? "DOCUMENT_MASTER_UPDATED" : "DOCUMENT_MASTER_CREATED",
      entityType: "DocumentChecklistItem",
      entityId: item.id,
      metadata: { name: item.name, code: item.code },
    });

    revalidatePath("/dashboard/settings/documents");
    return successState(id ? "Document Master configuration updated." : "New Document Master item created.");
  } catch (error: any) {
    if (error.code === "P2002") {
      return validationError("A document with this unique code or name already exists.");
    }
    throw error;
  }
}

export async function toggleDocumentMasterStatusAction(id: string, active: boolean) {
  const { user, companyId } = await getScopedCompanyId("branding:manage");
  
  const updated = await prisma.documentchecklistitem.update({
    where: { id, companyId },
    data: { isActive: active, updatedAt: new Date() }
  });

  await audit({
    companyId,
    actorId: user.id,
    action: active ? "DOCUMENT_MASTER_ENABLED" : "DOCUMENT_MASTER_DISABLED",
    entityType: "DocumentChecklistItem",
    entityId: id,
    metadata: { name: updated.name, code: updated.code },
  });

  revalidatePath("/dashboard/settings/documents");
}
