import "server-only";
import type {
  EmailSmtpConfig,
  ProviderSendResult,
  WhatsAppCloudConfig,
  SmsHttpConfig,
} from "@/lib/communications/providers/types";
import type { notificationdelivery_status } from "@/lib/generated/prisma/client";
import {
  accountProviderConfig,
  deliveryDryRun,
  environmentProviderConfig,
  providerForChannel,
} from "@/lib/communications/accounts";
import { emailSmtpProvider } from "@/lib/communications/providers/email-smtp";
import { whatsappCloudProvider } from "@/lib/communications/providers/whatsapp-cloud";
import { communicationEncryptionAvailable } from "@/lib/communications/encryption";
import { smsHttpProvider } from "@/lib/communications/providers/sms-http";
import { prisma } from "@/lib/db/prisma";

// Future AI may prepare drafts/outbox records only. Human approval remains the
// default send boundary and must never bypass RBAC, tenant scope, or template safety.
export async function runNotificationDelivery({
  companyId,
  deliveryId,
  communicationAccountId,
  allowedStatuses = ["PENDING", "FAILED"],
}: {
  companyId: string;
  deliveryId: string;
  communicationAccountId?: string | null;
  /**
   * Statuses the delivery row is allowed to be in right now. Manual "send now"
   * requires PENDING/FAILED (the default). The cron dispatcher atomically
   * claims a row by moving it to PROCESSING first, so it passes ["PROCESSING"]
   * here -- the row is already known-claimed, this just re-confirms identity.
   */
  allowedStatuses?: notificationdelivery_status[];
}) {
  if (!deliveryDryRun() && !communicationEncryptionAvailable()) {
    throw new Error("COMMUNICATION_SECRET_KEY is required before real delivery can be enabled.");
  }
  const delivery = await prisma.notificationdelivery.findFirst({
    where: {
      id: deliveryId,
      companyId,
      deletedAt: null,
      status: { in: allowedStatuses },
    },
    include: { notificationtemplate: { select: { key: true } } },
  });
  if (!delivery) throw new Error("Delivery is not available for sending.");

  const expectedProvider = providerForChannel(delivery.channel);
  if (!expectedProvider) throw new Error("This delivery channel is not supported.");

  const allowedAccountStatuses = deliveryDryRun()
    ? (["DISCONNECTED", "CONNECTING", "CONNECTED", "FAILED"] as const)
    : (["CONNECTED"] as const);
  const account = communicationAccountId
    ? await prisma.communicationaccount.findFirst({
        where: {
          id: communicationAccountId,
          companyId,
          channel: delivery.channel,
          status: { in: [...allowedAccountStatuses] },
          deletedAt: null,
        },
      })
    : await prisma.communicationaccount.findFirst({
        where: {
          companyId,
          channel: delivery.channel,
          isDefaultCompanyAccount: true,
          status: { in: [...allowedAccountStatuses] },
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
      });
  if (communicationAccountId && !account) {
    throw new Error("Communication account was not found for this company and channel.");
  }
  const provider = account?.provider ?? expectedProvider;
  if (provider === "WHATSAPP_WEB_QR_EXPERIMENTAL") {
    throw new Error("Experimental QR accounts cannot send messages in this phase.");
  }

  await prisma.notificationdelivery.update({
    where: { id: delivery.id },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      communicationAccountId: account?.id ?? null,
      provider,
      errorMessage: null,
      updatedAt: new Date(),
    },
  });

  let result: ProviderSendResult;
  try {
    const config = account
      ? accountProviderConfig(account)
      : environmentProviderConfig(provider);
    if (provider === "EMAIL_SMTP") {
      result = await emailSmtpProvider.send(config as EmailSmtpConfig, {
        channel: delivery.channel,
        recipientEmail: delivery.recipientEmail,
        subject: delivery.subject,
        messageBody: delivery.messageBody,
        templateKey: delivery.notificationtemplate?.key,
      });
    } else if (provider === "WHATSAPP_CLOUD_API") {
      result = await whatsappCloudProvider.send(config as WhatsAppCloudConfig, {
        channel: delivery.channel,
        recipientPhone: delivery.recipientPhone,
        messageBody: delivery.messageBody,
        templateKey: delivery.notificationtemplate?.key,
        templateLanguage: process.env.WHATSAPP_DEFAULT_LANGUAGE || "en_US",
      });
    } else {
      result = await smsHttpProvider.send(config as SmsHttpConfig, {
        channel: delivery.channel,
        recipientPhone: delivery.recipientPhone,
        messageBody: delivery.messageBody,
        templateKey: delivery.notificationtemplate?.key,
      });
    }
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : "Communication provider failed.",
    };
  }

  const now = new Date();
  await prisma.notificationdelivery.update({
    where: { id: delivery.id },
    data: result.ok
      ? {
          status: "SENT",
          sentAt: now,
          failedAt: null,
          providerMessageId: result.providerMessageId ?? (deliveryDryRun() ? `DRY_RUN_${Date.now()}` : null),
          errorMessage: null,
          updatedAt: now,
        }
      : result.skipped
        ? {
            status: "SKIPPED",
            failedAt: null,
            errorMessage: result.error ?? "Delivery skipped.",
            updatedAt: now,
          }
        : {
            status: "FAILED",
            failedAt: now,
            errorMessage: result.error ?? "Delivery failed.",
            updatedAt: now,
          },
  });
  return result;
}
