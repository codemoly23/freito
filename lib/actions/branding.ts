"use server";

import { randomUUID } from "node:crypto";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { logoExtension, validateLogoFile } from "@/lib/branding/storage";
import { blobDelete, blobPut } from "@/lib/blob/client";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

export async function uploadCompanyLogo(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("branding:manage");
  const file = formData.get("logo");
  if (!(file instanceof File)) return validationError("Select a logo image.");
  const error = validateLogoFile(file);
  if (error) return validationError(error);

  // Fetch existing logo key to delete after successful upload
  const existing = await prisma.company.findFirst({
    where: { id: companyId },
    select: { logoPath: true },
  });

  const ext = logoExtension(file);
  const blobName = `branding/${companyId}/${Date.now()}-${randomUUID()}${ext}`;
  await blobPut(blobName, await file.arrayBuffer(), file.type);

  await prisma.company.update({
    where: { id: companyId },
    data: { logoPath: blobName, logoMimeType: file.type, logoUpdatedAt: new Date() },
  });

  // Remove old blob after DB update succeeds
  if (existing?.logoPath && existing.logoPath !== blobName) {
    await blobDelete(existing.logoPath);
  }

  await audit({
    companyId,
    actorId: user.id,
    action: "COMPANY_LOGO_UPDATED",
    entityType: "Company",
    entityId: companyId,
  });
  revalidatePath("/dashboard/settings/branding");
  revalidatePath("/dashboard");
  return successState("Company logo updated.");
}

export async function saveHblPrintSettings(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("branding:manage");

  const hblOriginalsLimit = parseInt(getString(formData, "hblOriginalsLimit") || "3", 10);
  const hblOfficeLimit = parseInt(getString(formData, "hblOfficeLimit") || "1", 10);
  const hblAccountsLimit = parseInt(getString(formData, "hblAccountsLimit") || "1", 10);
  const hblOperationsLimit = parseInt(getString(formData, "hblOperationsLimit") || "1", 10);
  const hblCustomerLimit = parseInt(getString(formData, "hblCustomerLimit") || "1", 10);
  const hblArchiveLimit = parseInt(getString(formData, "hblArchiveLimit") || "1", 10);
  const hblPrintWatermarkEnabled = getString(formData, "hblPrintWatermarkEnabled") === "true";

  if (
    isNaN(hblOriginalsLimit) || hblOriginalsLimit < 0 ||
    isNaN(hblOfficeLimit) || hblOfficeLimit < 0 ||
    isNaN(hblAccountsLimit) || hblAccountsLimit < 0 ||
    isNaN(hblOperationsLimit) || hblOperationsLimit < 0 ||
    isNaN(hblCustomerLimit) || hblCustomerLimit < 0 ||
    isNaN(hblArchiveLimit) || hblArchiveLimit < 0
  ) {
    return validationError("All limits must be non-negative integers.");
  }

  await prisma.company.update({
    where: { id: companyId },
    data: {
      hblOriginalsLimit,
      hblOfficeLimit,
      hblAccountsLimit,
      hblOperationsLimit,
      hblCustomerLimit,
      hblArchiveLimit,
      hblPrintWatermarkEnabled,
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "HBL_PRINT_SETTINGS_UPDATED",
    entityType: "Company",
    entityId: companyId,
    metadata: {
      hblOriginalsLimit,
      hblOfficeLimit,
      hblAccountsLimit,
      hblOperationsLimit,
      hblCustomerLimit,
      hblArchiveLimit,
      hblPrintWatermarkEnabled,
    },
  });

  revalidatePath("/dashboard/settings/branding");
  return successState("HBL print settings updated successfully.");
}

