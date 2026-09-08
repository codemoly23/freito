import "server-only";
import type {
  CommunicationProviderAdapter,
  ProviderSendInput,
  ProviderSendResult,
  WhatsAppCloudConfig,
} from "@/lib/communications/providers/types";

function dryRun() {
  return process.env.DELIVERY_DRY_RUN !== "false";
}

function whatsappEnabled() {
  return process.env.WHATSAPP_DELIVERY_ENABLED === "true";
}

function apiVersion() {
  return process.env.WHATSAPP_API_VERSION || "v22.0";
}

function normalizedPhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

export const whatsappCloudProvider: CommunicationProviderAdapter<WhatsAppCloudConfig> = {
  provider: "WHATSAPP_CLOUD_API",
  channel: "WHATSAPP",
  async testConnection(config) {
    if (dryRun()) return { ok: true };
    if (!whatsappEnabled()) return { ok: false, error: "WhatsApp delivery is disabled." };
    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion()}/${encodeURIComponent(config.phoneNumberId)}?fields=id,display_phone_number`,
        { headers: { Authorization: `Bearer ${config.accessToken}` }, cache: "no-store" },
      );
      return response.ok
        ? { ok: true }
        : { ok: false, error: "WhatsApp Cloud API connection failed." };
    } catch {
      return { ok: false, error: "WhatsApp Cloud API connection failed." };
    }
  },
  async send(config, input: ProviderSendInput): Promise<ProviderSendResult> {
    if (!input.recipientPhone) return { ok: false, skipped: true, error: "Recipient phone is missing." };
    if (!input.templateKey) {
      return { ok: false, error: "WhatsApp delivery requires an approved template key." };
    }
    if (dryRun()) {
      return {
        ok: true,
        providerMessageId: `DRY_RUN_WHATSAPP_${Date.now()}`,
        sanitizedResponse: { dryRun: true, template: input.templateKey },
      };
    }
    if (!whatsappEnabled()) return { ok: false, error: "WhatsApp delivery is disabled." };
    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion()}/${encodeURIComponent(config.phoneNumberId)}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: normalizedPhone(input.recipientPhone),
            type: "template",
            template: {
              name: input.templateKey,
              language: { code: input.templateLanguage || config.defaultLanguage || "en_US" },
            },
          }),
          cache: "no-store",
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>;
      };
      if (!response.ok) return { ok: false, error: "WhatsApp Cloud API delivery failed." };
      return {
        ok: true,
        providerMessageId: body.messages?.[0]?.id || `WHATSAPP_${Date.now()}`,
        sanitizedResponse: { accepted: true },
      };
    } catch {
      return { ok: false, error: "WhatsApp Cloud API delivery failed." };
    }
  },
};
