"use server";

import crypto from "crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { customerSchema } from "@/lib/validators/admin";
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

export async function saveCustomer(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("customers:manage");
  const targetCompanyId = companyId ?? getString(formData, "companyId");
  if (!targetCompanyId) return validationError("Company is required.");

  const parsed = customerSchema.safeParse({
    id: getString(formData, "id") || undefined,
    name: getString(formData, "name"),
    code: getString(formData, "code"),
    email: getString(formData, "email"),
    phone: getString(formData, "phone"),
    address: getString(formData, "address"),
    binOrVat: getString(formData, "binOrVat"),
    status: getString(formData, "status") || "ACTIVE",
    contactName: getString(formData, "contactName"),
    contactEmail: getString(formData, "contactEmail"),
    contactPhone: getString(formData, "contactPhone"),
    contactDesignation: getString(formData, "contactDesignation"),
  });

  if (!parsed.success) {
    return validationError(
      "Please fix the highlighted customer fields.",
      parsed.error.flatten().fieldErrors,
    );
  }

  try {
    const {
      id,
      contactName,
      contactEmail,
      contactPhone,
      contactDesignation,
      ...data
    } = parsed.data;

    if (id) {
      const existing = await prisma.customer.findUniqueOrThrow({ where: { id } });
      if (existing.companyId !== targetCompanyId) {
        return validationError("Customer was not found or is outside your company.");
      }
    }

    const previousCustomer = id
      ? await prisma.customer.findUnique({ where: { id } })
      : null;

    const customer = id
      ? await prisma.customer.update({
          where: { id },
          data: { ...data, updatedAt: new Date() },
        })
      : await prisma.customer.create({
          data: {
            id: crypto.randomUUID(),
            ...data,
            updatedAt: new Date(),
            companyId: targetCompanyId,
            customercontact: contactName
              ? {
                  create: {
                    id: crypto.randomUUID(),
                    name: contactName,
                    email: contactEmail,
                    phone: contactPhone,
                    designation: contactDesignation,
                    isPrimary: true,
                    updatedAt: new Date(),
                  },
                }
              : undefined,
          },
        });

    if (id && contactName) {
      const existingContact = await prisma.customercontact.findFirst({
        where: { customerId: id, isPrimary: true },
      });

      if (existingContact) {
        await prisma.customercontact.update({
          where: { id: existingContact.id },
          data: {
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            designation: contactDesignation,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.customercontact.create({
          data: {
            id: crypto.randomUUID(),
            customerId: id,
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            designation: contactDesignation,
            isPrimary: true,
            updatedAt: new Date(),
          },
        });
      }
    }

    await audit({
      companyId: targetCompanyId,
      actorId: user.id,
      action: id ? "customer.updated" : "customer.created",
      entityType: "Customer",
      entityId: customer.id,
      metadata: { name: customer.name },
    });

    if (id && previousCustomer?.status !== customer.status) {
      await audit({
        companyId: targetCompanyId,
        actorId: user.id,
        action: "CUSTOMER_STATUS_CHANGED",
        entityType: "Customer",
        entityId: customer.id,
        metadata: { from: previousCustomer?.status, to: customer.status },
      });
    }

    revalidateAdminPaths();
    return successState(id ? "Customer updated." : "Customer created.");
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return validationError("A customer with this code already exists.", {
        code: ["A customer with this code already exists."],
      });
    }

    throw error;
  }
}

export async function deleteCustomer(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("customers:manage");
  const targetCompanyId = companyId ?? getString(formData, "companyId");
  if (!targetCompanyId) return;

  const id = getString(formData, "id");
  const existing = await prisma.customer.findUniqueOrThrow({ where: { id } });
  if (existing.companyId !== targetCompanyId) return;

  const customer = await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), status: "INACTIVE" },
  });

  await audit({
    companyId: targetCompanyId,
    actorId: user.id,
    action: "customer.deleted",
    entityType: "Customer",
    entityId: customer.id,
    metadata: { name: customer.name },
  });

  revalidateAdminPaths();
}
