import "server-only";
import type { CommunicationProviderAdapter, ProviderSendResult, SmsHttpConfig } from "@/lib/communications/providers/types";

function dryRun() {
  return process.env.DELIVERY_DRY_RUN !== "false";
}

export const smsHttpProvider: CommunicationProviderAdapter<SmsHttpConfig> = {
  provider: "SMS_HTTP_API",
  channel: "SMS",
  async testConnection(config) {
    if (dryRun()) return { ok: true };
    if (process.env.SMS_DELIVERY_ENABLED !== "true") return { ok: false, error: "SMS delivery is disabled." };
    return config.baseUrl && config.apiKey
      ? { ok: true }
      : { ok: false, error: "SMS provider configuration is incomplete." };
  },
  async send(config, input): Promise<ProviderSendResult> {
    if (!input.recipientPhone) return { ok: false, skipped: true, error: "Recipient phone is missing." };
    if (dryRun()) return { ok: true, providerMessageId: `DRY_RUN_SMS_${Date.now()}`, sanitizedResponse: { dryRun: true } };
    if (process.env.SMS_DELIVERY_ENABLED !== "true") return { ok: false, error: "SMS delivery is disabled." };
    if (!config.baseUrl || !config.apiKey) return { ok: false, error: "SMS provider configuration is incomplete." };
    try {
      const response = await fetch(config.baseUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: input.recipientPhone, message: input.messageBody, senderId: config.senderId }),
        cache: "no-store",
      });
      if (!response.ok) return { ok: false, error: "SMS provider delivery failed." };
      return { ok: true, providerMessageId: `SMS_${Date.now()}`, sanitizedResponse: { accepted: true } };
    } catch {
      return { ok: false, error: "SMS provider delivery failed." };
    }
  },
};
