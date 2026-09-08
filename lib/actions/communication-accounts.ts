"use server";

import crypto from "crypto";
import { Prisma } from "@/lib/generated/prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  accountProviderConfig,
  deliveryDryRun,
} from "@/lib/communications/accounts";
import {
  communicationEncryptionAvailable,
  encryptCommunicationConfig,
} from "@/lib/communications/encryption";
import { emailSmtpProvider } from "@/lib/communications/providers/email-smtp";
import type { EmailSmtpConfig, WhatsAppCloudConfig } from "@/lib/communications/providers/types";
import { whatsappCloudProvider } from "@/lib/communications/providers/whatsapp-cloud";
import { audit, getScopedCompanyId, getString } from "@/lib/actions/helpers";
import { prisma } from "@/lib/db/prisma";

function accountError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function encryptedConfig(config: Record<string, unknown>) {
  if (communicationEncryptionAvailable()) {
    return encryptCommunicationConfig(config) as unknown as Prisma.InputJsonValue;
  }
  if (deliveryDryRun()) return undefined;
  throw new Error("COMMUNICATION_SECRET_KEY is required before saving real credentials.");
}

export async function createEmailSmtpAccount(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("communicationAccounts:connect");
  const path = "/dashboard/communication-accounts/new/email";
  const displayName = getString(formData, "displayName").trim();
  const host = getString(formData, "host").trim();
  const port = Number(getString(formData, "port"));
  const username = getString(formData, "username").trim();
  const password = getString(formData, "password");
  const fromEmail = getString(formData, "fromEmail").trim();
  const fromName = getString(formData, "fromName").trim();
  const secure = getString(formData, "secure") === "true";
  if (!displayName || !host || !port || !username || !password || !fromEmail) {
    accountError(path, "Complete all required SMTP fields.");
  }
  const config: EmailSmtpConfig = { host, port, secure, user: username, password, fromEmail, fromName };
  let encrypted: Prisma.InputJsonValue | undefined;
  try {
    encrypted = encryptedConfig(config);
  } catch (error) {
    accountError(path, error instanceof Error ? error.message : "Unable to secure SMTP credentials.");
  }
  const isUserOwned = getString(formData, "ownership") === "user";
  const account = await prisma.communicationaccount.create({
    data: {
      id: crypto.randomUUID(),
      companyId,
      userId: isUserOwned ? user.id : null,
      provider: "EMAIL_SMTP",
      channel: "EMAIL",
      displayName,
      senderEmail: fromEmail,
      status: "DISCONNECTED",
      isUserOwned,
      encryptedConfig: encrypted ? JSON.stringify(encrypted) : null,
      lastError: encrypted ? null : "Dry-run account: credentials were not stored because COMMUNICATION_SECRET_KEY is unset.",
      updatedAt: new Date(),
    },
  });
  await audit({ companyId, actorId: user.id, action: "COMMUNICATION_ACCOUNT_CREATED", entityType: "CommunicationAccount", entityId: account.id, metadata: { provider: account.provider, channel: account.channel } });
  redirect("/dashboard/communication-accounts");
}

export async function createWhatsAppCloudAccount(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("communicationAccounts:connect");
  const path = "/dashboard/communication-accounts/new/whatsapp-cloud";
  const displayName = getString(formData, "displayName").trim();
  const phoneNumberId = getString(formData, "phoneNumberId").trim();
  const businessAccountId = getString(formData, "businessAccountId").trim();
  const defaultLanguage = getString(formData, "defaultLanguage").trim() || "en_US";
  const accessToken = getString(formData, "accessToken");
  const senderPhone = getString(formData, "senderPhone").trim();
  if (!displayName || !phoneNumberId || !accessToken) {
    accountError(path, "Display name, phone number ID, and access token are required.");
  }
  const config: WhatsAppCloudConfig = { accessToken, phoneNumberId, businessAccountId, defaultLanguage };
  let encrypted: Prisma.InputJsonValue | undefined;
  try {
    encrypted = encryptedConfig(config);
  } catch (error) {
    accountError(path, error instanceof Error ? error.message : "Unable to secure WhatsApp credentials.");
  }
  const isUserOwned = getString(formData, "ownership") === "user";
  const account = await prisma.communicationaccount.create({
    data: {
      id: crypto.randomUUID(),
      companyId,
      userId: isUserOwned ? user.id : null,
      provider: "WHATSAPP_CLOUD_API",
      channel: "WHATSAPP",
      displayName,
      senderPhone: senderPhone || null,
      whatsappPhoneNumberId: phoneNumberId,
      whatsappBusinessAccountId: businessAccountId || null,
      status: "DISCONNECTED",
      isUserOwned,
      encryptedConfig: encrypted ? JSON.stringify(encrypted) : null,
      lastError: encrypted ? null : "Dry-run account: token was not stored because COMMUNICATION_SECRET_KEY is unset.",
      updatedAt: new Date(),
    },
  });
  await audit({ companyId, actorId: user.id, action: "COMMUNICATION_ACCOUNT_CREATED", entityType: "CommunicationAccount", entityId: account.id, metadata: { provider: account.provider, channel: account.channel } });
  redirect("/dashboard/communication-accounts");
}

export async function testCommunicationAccount(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("communicationAccounts:test");
  const id = getString(formData, "accountId");
  const account = await prisma.communicationaccount.findFirst({
    where: { id, companyId, deletedAt: null, status: { not: "DISABLED" } },
  });
  if (!account) return;
  let result: { ok: boolean; error?: string };
  try {
    const config = accountProviderConfig(account);
    result = account.provider === "EMAIL_SMTP"
      ? await emailSmtpProvider.testConnection(config as EmailSmtpConfig)
      : account.provider === "WHATSAPP_CLOUD_API"
        ? await whatsappCloudProvider.testConnection(config as WhatsAppCloudConfig)
        : { ok: false, error: "Experimental QR adapter has no live session." };
  } catch (error) {
    result = { ok: false, error: error instanceof Error ? error.message : "Connection test failed." };
  }
  await prisma.communicationaccount.update({
    where: { id: account.id },
    data: result.ok
      ? { status: "CONNECTED", lastConnectedAt: new Date(), lastError: null, updatedAt: new Date() }
      : { status: "FAILED", lastError: result.error ?? "Connection test failed.", updatedAt: new Date() },
  });
  await audit({ companyId, actorId: user.id, action: "COMMUNICATION_ACCOUNT_TESTED", entityType: "CommunicationAccount", entityId: account.id, metadata: { provider: account.provider, ok: result.ok } });
  revalidatePath("/dashboard/communication-accounts");
}

export async function manageCommunicationAccount(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("communicationAccounts:manage");
  const id = getString(formData, "accountId");
  const action = getString(formData, "action");
  const account = await prisma.communicationaccount.findFirst({
    where: { id, companyId, deletedAt: null },
  });
  if (!account) return;
  if (action === "DEFAULT") {
    await prisma.$transaction([
      prisma.communicationaccount.updateMany({
        where: { companyId, channel: account.channel, isDefaultCompanyAccount: true },
        data: { isDefaultCompanyAccount: false, updatedAt: new Date() },
      }),
      prisma.communicationaccount.update({
        where: { id: account.id },
        data: { isDefaultCompanyAccount: true, updatedAt: new Date() },
      }),
    ]);
  } else if (action === "DISABLE") {
    await prisma.communicationaccount.update({
      where: { id: account.id },
      data: { status: "DISABLED", isDefaultCompanyAccount: false, updatedAt: new Date() },
    });
  } else if (action === "DISCONNECT") {
    await prisma.communicationaccount.update({
      where: { id: account.id },
      data: {
        status: "DISCONNECTED",
        isDefaultCompanyAccount: false,
        encryptedConfig: null,
        lastConnectedAt: null,
        lastError: null,
        updatedAt: new Date(),
      },
    });
  }
  await audit({ companyId, actorId: user.id, action: `COMMUNICATION_ACCOUNT_${action}`, entityType: "CommunicationAccount", entityId: account.id, metadata: { provider: account.provider } });
  revalidatePath("/dashboard/communication-accounts");
}
