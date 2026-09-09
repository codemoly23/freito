"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { hashPassword, generateOneTimePassword, verifyPassword } from "@/lib/auth/password";
import { ensureModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { createPortalActivationInvitation } from "@/lib/client-portal/activation";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

function cleanPrefix(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function prefixFromName(name: string) {
  const words = name.match(/[A-Za-z0-9]+/g) ?? [];
  const initials = words.map((word) => word[0]).join("");
  return cleanPrefix(initials || name.slice(0, 3)) || "CLI";
}

async function createAccountWithSequence({
  companyId,
  customerId,
  email,
  phone,
  passwordHash,
  plainPassword,
  createdById,
  prefix,
}: {
  companyId: string;
  customerId: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  plainPassword: string;
  createdById: string;
  prefix: string;
}) {
  const year = new Date().getFullYear();
  return prisma.$transaction(async (tx) => {
    const existing = await tx.clientportalaccount.findMany({
      where: { companyId, clientCode: { startsWith: `${prefix}-CL-${year}-` } },
      select: { clientCode: true },
    });
    const max = existing.reduce((value, account) => {
      const parts = account.clientCode.split("-");
      const sequence = Number(parts[parts.length - 1]);
      return Number.isFinite(sequence) ? Math.max(value, sequence) : value;
    }, 0);
    const sequence = await tx.clientportalsequence.upsert({
      where: { companyId_year: { companyId, year } },
      create: { id: randomBytes(16).toString("hex"), companyId, year, currentSequence: max + 1, updatedAt: new Date() },
      update: { currentSequence: { increment: 1 } },
      select: { currentSequence: true },
    });

    let currentSeq = sequence.currentSequence;
    if (currentSeq <= max) {
      const nextSeq = max + 1;
      await tx.clientportalsequence.update({
        where: { companyId_year: { companyId, year } },
        data: { currentSequence: nextSeq },
      });
      currentSeq = nextSeq;
    }
    const displayClientCode = `${prefix}-CL-${year}-${String(
      currentSeq,
    ).padStart(4, "0")}`;
    return tx.clientportalaccount.create({
      data: {
        id: randomBytes(16).toString("hex"),
        companyId,
        customerId,
        clientCode: displayClientCode,
        displayClientCode,
        email,
        phone,
        passwordHash,
        plainPassword,
        status: "ACTIVE",
        mustChangePassword: true,
        createdById,
        updatedAt: new Date(),
      },
    });
  });
}

export async function createClientPortalAccount(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("clientPortalAccounts:create");
  const moduleError = await ensureModuleAccess(companyId, "CLIENT_PORTAL");
  if (moduleError) return validationError(moduleError);

  const customerId = getString(formData, "customerId");
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId, deletedAt: null },
    include: { customercontact: { where: { isPrimary: true }, take: 1 } },
  });
  if (!customer) return validationError("Customer was not found.");

  const existing = await prisma.clientportalaccount.findFirst({
    where: { customerId, companyId, deletedAt: null },
    select: { id: true },
  });
  if (existing) return validationError("This customer already has portal access.");

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      portalSlug: true,
      portalDisplayName: true,
      portalCodePrefix: true,
      portalEnabled: true,
    },
  });
  if (!company?.portalEnabled || !company.portalSlug) {
    return validationError("The company client portal is not enabled or configured.");
  }

  const prefix = cleanPrefix(company.portalCodePrefix ?? "") || prefixFromName(company.name);
  const email = customer.customercontact[0]?.email ?? customer.email;
  const phone = customer.customercontact[0]?.phone ?? customer.phone;
  const oneTimePassword = generateOneTimePassword();
  const passwordHash = await hashPassword(oneTimePassword);
  let account = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      account = await createAccountWithSequence({
        companyId,
        customerId,
        email,
        phone,
        passwordHash,
        plainPassword: oneTimePassword,
        createdById: user.id,
        prefix,
      });
      break;
    } catch (error) {
      const isConflict =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002";
      if (!isConflict || attempt === 3) {
        if (isConflict) {
          return validationError("Could not generate a unique Client ID. Please try again.");
        }
        throw error;
      }
    }
  }
  if (!account) return validationError("Could not create client portal access.");

  const invitation = await createPortalActivationInvitation({
    companyId,
    customerId,
    clientPortalAccountId: account.id,
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "CLIENT_PORTAL_ACCOUNT_CREATED",
    entityType: "ClientPortalAccount",
    entityId: account.id,
    metadata: {
      customerId,
      displayClientCode: account.displayClientCode,
      expiresAt: invitation.expiresAt,
      deliveryCount: invitation.deliveries.length,
    },
  });

  revalidatePath(`/dashboard/customers/${customerId}/portal-access`);
  return {
    ...successState(`Portal account created and invitation prepared. Client ID: ${account.displayClientCode} | One Time Password: ${oneTimePassword}`),
    activationLink: invitation.activationLink,
  };
}

export async function resetClientPortalPassword(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId(
    "clientPortalAccounts:resetPassword",
  );
  if (await ensureModuleAccess(companyId, "CLIENT_PORTAL")) {
    return validationError("This module is not enabled for your company plan.");
  }
  const id = getString(formData, "id");
  const account = await prisma.clientportalaccount.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!account) return validationError("Portal account was not found.");

  const newPassword = generateOneTimePassword();
  await prisma.clientportalaccount.update({
    where: { id: account.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      plainPassword: newPassword,
      mustChangePassword: true,
      status: "ACTIVE",
    },
  });
  const invitation = await createPortalActivationInvitation({
    companyId,
    customerId: account.customerId,
    clientPortalAccountId: account.id,
    resend: true,
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "CLIENT_PORTAL_ACCOUNT_PASSWORD_RESET",
    entityType: "ClientPortalAccount",
    entityId: account.id,
    metadata: { customerId: account.customerId, displayClientCode: account.displayClientCode },
  });
  revalidatePath(`/dashboard/customers/${account.customerId}/portal-access`);
  return {
    ...successState(`Portal access reset. New One-Time Password: ${newPassword}`),
    activationLink: invitation.activationLink,
  };
}

export async function resendClientPortalInvitation(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("clientPortalAccounts:update");
  const id = getString(formData, "id");
  const account = await prisma.clientportalaccount.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!account) return validationError("Portal account was not found.");
  const invitation = await createPortalActivationInvitation({
    companyId,
    customerId: account.customerId,
    clientPortalAccountId: account.id,
    resend: true,
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "CLIENT_PORTAL_INVITATION_RESENT",
    entityType: "ClientPortalAccount",
    entityId: account.id,
    metadata: { customerId: account.customerId, displayClientCode: account.displayClientCode },
  });
  revalidatePath(`/dashboard/customers/${account.customerId}/portal-access`);
  return {
    ...successState("Portal invitation resent."),
    activationLink: invitation.activationLink,
  };
}

export async function updateClientPortalAccount(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("clientPortalAccounts:update");
  if (await ensureModuleAccess(companyId, "CLIENT_PORTAL")) {
    return validationError("This module is not enabled for your company plan.");
  }
  const id = getString(formData, "id");
  const email = getString(formData, "email").trim().toLowerCase() || null;
  const phone = getString(formData, "phone").trim() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return validationError("Enter a valid contact email.", {
      email: ["Enter a valid contact email."],
    });
  }
  const account = await prisma.clientportalaccount.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!account) return validationError("Portal account was not found.");
  await prisma.clientportalaccount.update({
    where: { id },
    data: { email, phone },
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "CLIENT_PORTAL_ACCOUNT_UPDATED",
    entityType: "ClientPortalAccount",
    entityId: id,
    metadata: { customerId: account.customerId, displayClientCode: account.displayClientCode },
  });
  revalidatePath(`/dashboard/customers/${account.customerId}/portal-access`);
  return successState("Portal contact information updated.");
}

export async function updateClientPortalStatus(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("clientPortalAccounts:update");
  const id = getString(formData, "id");
  const status = getString(formData, "status") as
    | "ACTIVE"
    | "SUSPENDED"
    | "INVITED";
  if (!["ACTIVE", "SUSPENDED", "INVITED"].includes(status)) {
    return validationError("Invalid status value.");
  }
  const account = await prisma.clientportalaccount.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!account) return validationError("Portal account was not found.");
  await prisma.clientportalaccount.update({ where: { id }, data: { status } });
  await audit({
    companyId,
    actorId: user.id,
    action: "CLIENT_PORTAL_ACCOUNT_STATUS_CHANGED",
    entityType: "ClientPortalAccount",
    entityId: account.id,
    metadata: { from: account.status, to: status },
  });
  revalidatePath(`/dashboard/customers/${account.customerId}/portal-access`);
  return successState("Portal status updated.");
}

export async function toggleClientPortalAccount(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("clientPortalAccounts:update");
  if (await ensureModuleAccess(companyId, "CLIENT_PORTAL")) return;
  const id = getString(formData, "id");
  const account = await prisma.clientportalaccount.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!account) return;
  const status = account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
  await prisma.clientportalaccount.update({ where: { id }, data: { status } });
  await audit({
    companyId,
    actorId: user.id,
    action:
      status === "ACTIVE"
        ? "CLIENT_PORTAL_ACCOUNT_ACTIVATED"
        : "CLIENT_PORTAL_ACCOUNT_SUSPENDED",
    entityType: "ClientPortalAccount",
    entityId: id,
    metadata: { customerId: account.customerId, displayClientCode: account.displayClientCode },
  });
  revalidatePath(`/dashboard/customers/${account.customerId}/portal-access`);
}

export async function deleteClientPortalAccount(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("clientPortalAccounts:delete");
  if (await ensureModuleAccess(companyId, "CLIENT_PORTAL")) return;
  const id = getString(formData, "id");
  const account = await prisma.clientportalaccount.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!account) return;
  await prisma.clientportalaccount.update({
    where: { id },
    data: { deletedAt: new Date(), status: "SUSPENDED" },
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "CLIENT_PORTAL_ACCOUNT_DELETED",
    entityType: "ClientPortalAccount",
    entityId: id,
    metadata: { customerId: account.customerId, displayClientCode: account.displayClientCode },
  });
  revalidatePath(`/dashboard/customers/${account.customerId}/portal-access`);
}

export async function changeClientPortalPassword(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const companySlug = getString(formData, "companySlug");
  const currentPassword = getString(formData, "currentPassword");
  const newPassword = getString(formData, "newPassword");
  const confirmPassword = getString(formData, "confirmPassword");

  if (!currentPassword) return validationError("Current password is required.");
  if (!newPassword || newPassword.length < 6) {
    return validationError("New password must be at least 6 characters long.");
  }
  if (newPassword !== confirmPassword) {
    return validationError("New password and confirmation password do not match.");
  }

  const { requirePortalAccount } = await import("@/lib/client-portal/access");
  const { account } = await requirePortalAccount(companySlug);

  const fullAccount = await prisma.clientportalaccount.findUnique({
    where: { id: account.id },
    select: { id: true, passwordHash: true, customerId: true, displayClientCode: true },
  });

  if (!fullAccount) return validationError("Portal account was not found.");

  const isValid = await verifyPassword(currentPassword, fullAccount.passwordHash);
  if (!isValid) return validationError("Current password is incorrect.");

  const newHash = await hashPassword(newPassword);

  await prisma.clientportalaccount.update({
    where: { id: fullAccount.id },
    data: {
      passwordHash: newHash,
      plainPassword: null,
      mustChangePassword: false,
      status: "ACTIVE",
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId: account.companyId,
    actorId: null,
    action: "CLIENT_PORTAL_PASSWORD_CHANGED",
    entityType: "ClientPortalAccount",
    entityId: account.id,
    metadata: { displayClientCode: fullAccount.displayClientCode },
  });

  revalidatePath(`/portal/${companySlug}`);
  return successState("Password updated successfully.");
}

