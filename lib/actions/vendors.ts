"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { vendorSchema } from "@/lib/validators/admin";
import { ensureVendorLedgerAccount } from "@/lib/accounting/seed-chart-of-accounts";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  revalidateAdminPaths,
  successState,
  validationError,
} from "@/lib/actions/helpers";

export async function saveVendor(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("vendors:manage");
  const targetCompanyId = companyId ?? getString(formData, "companyId");
  if (!targetCompanyId) return validationError("Company is required.");

  const parsed = vendorSchema.safeParse({
    id: getString(formData, "id") || undefined,
    name: getString(formData, "name"),
    type: getString(formData, "type") || "OTHER",
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    address: getString(formData, "address"),
    paymentTerms: getString(formData, "paymentTerms"),
    notes: getString(formData, "notes"),
    status: getString(formData, "status") || "ACTIVE",
    contactName: getString(formData, "contactName"),
    contactEmail: getString(formData, "contactEmail"),
    contactPhone: getString(formData, "contactPhone"),
    contactDesignation: getString(formData, "contactDesignation"),
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted vendor fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const { id, contactName, contactEmail, contactPhone, contactDesignation, ...data } =
    parsed.data;

  if (id) {
    const existing = await prisma.vendor.findUniqueOrThrow({ where: { id } });
    if (existing.companyId !== targetCompanyId) {
      return validationError("Vendor was not found or is outside your company.");
    }
  }

  const previousVendor = id ? await prisma.vendor.findUnique({ where: { id } }) : null;
  const now = new Date();

  const vendor = id
    ? await prisma.vendor.update({
        where: { id },
        data: { ...data, updatedAt: now },
      })
    : await prisma.vendor.create({
        data: {
          ...data,
          id: randomUUID(),
          companyId: targetCompanyId,
          updatedAt: now,
          vendorcontact: contactName
            ? {
                create: {
                  id: randomUUID(),
                  name: contactName,
                  email: contactEmail,
                  phone: contactPhone,
                  designation: contactDesignation,
                  isPrimary: true,
                  updatedAt: now,
                },
              }
            : undefined,
      },
    });

  if (id && contactName) {
    const existingContact = await prisma.vendorcontact.findFirst({
      where: { vendorId: id, isPrimary: true },
    });

    if (existingContact) {
      await prisma.vendorcontact.update({
        where: { id: existingContact.id },
        data: {
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          designation: contactDesignation,
          updatedAt: now,
        },
      });
    } else {
      await prisma.vendorcontact.create({
        data: {
          id: randomUUID(),
          vendorId: id,
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
          designation: contactDesignation,
          isPrimary: true,
          updatedAt: now,
        },
      });
    }
  }

  if (!id) {
    try {
      await ensureVendorLedgerAccount(targetCompanyId, vendor.id, vendor.name);
    } catch (ledgerError) {
      console.error("Failed to create vendor ledger account", ledgerError);
    }
  }

  await audit({
    companyId: targetCompanyId,
    actorId: user.id,
    action: id ? "vendor.updated" : "vendor.created",
    entityType: "Vendor",
    entityId: vendor.id,
    metadata: { name: vendor.name, type: vendor.type },
  });

  if (id && previousVendor?.status !== vendor.status) {
    await audit({
      companyId: targetCompanyId,
      actorId: user.id,
      action: "VENDOR_STATUS_CHANGED",
      entityType: "Vendor",
      entityId: vendor.id,
      metadata: { from: previousVendor?.status, to: vendor.status },
    });
  }

  revalidateAdminPaths();
  return successState(id ? "Vendor updated." : "Vendor created.");
}

export async function deleteVendor(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("vendors:manage");
  const targetCompanyId = companyId ?? getString(formData, "companyId");
  if (!targetCompanyId) return;

  const id = getString(formData, "id");
  const existing = await prisma.vendor.findUniqueOrThrow({ where: { id } });
  if (existing.companyId !== targetCompanyId) return;

  const vendor = await prisma.vendor.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE", updatedAt: new Date() },
  });

  await audit({
    companyId: targetCompanyId,
    actorId: user.id,
    action: "vendor.deleted",
    entityType: "Vendor",
    entityId: vendor.id,
    metadata: { name: vendor.name, type: vendor.type },
  });

  revalidateAdminPaths();
}
