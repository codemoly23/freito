import "server-only";
import type {
  communicationaccount as CommunicationAccount,
  communicationaccount_provider as CommunicationProvider,
  communicationaccount_channel as NotificationChannel,
} from "@/lib/generated/prisma/client";
import { decryptCommunicationConfig } from "@/lib/communications/encryption";
import type { EmailSmtpConfig, ProviderConfig, SmsHttpConfig, WhatsAppCloudConfig } from "@/lib/communications/providers/types";
import { emailSmtpProvider } from "@/lib/communications/providers/email-smtp";
import { whatsappCloudProvider } from "@/lib/communications/providers/whatsapp-cloud";
import { whatsappWebQrProvider } from "@/lib/communications/providers/whatsapp-web-qr";
import { smsHttpProvider } from "@/lib/communications/providers/sms-http";

export function deliveryDryRun() {
  return process.env.DELIVERY_DRY_RUN !== "false";
}

export function providerForChannel(channel: NotificationChannel): CommunicationProvider | null {
  if (channel === "EMAIL") return "EMAIL_SMTP";
  if (channel === "WHATSAPP") return "WHATSAPP_CLOUD_API";
  if (channel === "SMS") return "SMS_HTTP_API";
  return null;
}

export function providerAdapter(provider: CommunicationProvider) {
  if (provider === "EMAIL_SMTP") return emailSmtpProvider;
  if (provider === "WHATSAPP_CLOUD_API") return whatsappCloudProvider;
  if (provider === "SMS_HTTP_API") return smsHttpProvider;
  return whatsappWebQrProvider;
}

export function environmentProviderConfig(provider: CommunicationProvider): ProviderConfig {
  if (provider === "EMAIL_SMTP") {
    return {
      host: process.env.SMTP_HOST || "",
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || "",
      password: process.env.SMTP_PASS || "",
      fromEmail: process.env.SMTP_FROM_EMAIL || "",
      fromName: process.env.SMTP_FROM_NAME || "",
    } satisfies EmailSmtpConfig;
  }
  if (provider === "WHATSAPP_CLOUD_API") {
    return {
      accessToken: process.env.WHATSAPP_CLOUD_API_TOKEN || "",
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
      defaultLanguage: process.env.WHATSAPP_DEFAULT_LANGUAGE || "en_US",
    } satisfies WhatsAppCloudConfig;
  }
  if (provider === "SMS_HTTP_API") {
    return {
      baseUrl: process.env.SMS_BASE_URL || "",
      apiKey: process.env.SMS_API_KEY || "",
      senderId: process.env.SMS_SENDER_ID || "",
      provider: process.env.SMS_PROVIDER || "",
    } satisfies SmsHttpConfig;
  }
  return {};
}

export function accountProviderConfig(account: CommunicationAccount): ProviderConfig {
  if (!account.encryptedConfig) {
    if (deliveryDryRun()) return {};
    throw new Error("Communication account credentials are unavailable.");
  }
  return decryptCommunicationConfig<ProviderConfig>(account.encryptedConfig);
}
