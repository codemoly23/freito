import "server-only";
import type { CommunicationProviderAdapter } from "@/lib/communications/providers/types";

export function canStartQrSession() {
  return process.env.WHATSAPP_WEB_QR_ENABLED === "true";
}

export const whatsappWebQrProvider: CommunicationProviderAdapter<Record<string, never>> = {
  provider: "WHATSAPP_WEB_QR_EXPERIMENTAL",
  channel: "WHATSAPP",
  async testConnection() {
    return canStartQrSession()
      ? { ok: false, error: "Experimental QR adapter is a placeholder and has no live session." }
      : { ok: false, error: "Experimental QR connector is disabled." };
  },
  async send() {
    return {
      ok: false,
      error: "Experimental QR sending is not implemented. Use WhatsApp Cloud API.",
    };
  },
};
