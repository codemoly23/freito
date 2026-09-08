import "server-only";
import nodemailer from "nodemailer";
import type {
  CommunicationProviderAdapter,
  EmailSmtpConfig,
  ProviderSendInput,
  ProviderSendResult,
} from "@/lib/communications/providers/types";

function dryRun() {
  return process.env.DELIVERY_DRY_RUN !== "false";
}

function emailEnabled() {
  return process.env.EMAIL_DELIVERY_ENABLED === "true";
}

function transporter(config: EmailSmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

function safeHeader(value: string, field: string) {
  if (/[\r\n]/.test(value)) throw new Error(`${field} contains invalid header characters.`);
  return value;
}

export const emailSmtpProvider: CommunicationProviderAdapter<EmailSmtpConfig> = {
  provider: "EMAIL_SMTP",
  channel: "EMAIL",
  async testConnection(config) {
    if (dryRun()) return { ok: true };
    if (!emailEnabled()) return { ok: false, error: "Email delivery is disabled." };
    try {
      await transporter(config).verify();
      return { ok: true };
    } catch {
      return { ok: false, error: "SMTP connection failed. Verify the account configuration." };
    }
  },
  async send(config, input: ProviderSendInput): Promise<ProviderSendResult> {
    if (!input.recipientEmail && (!input.bcc || input.bcc.length === 0)) {
      return { ok: false, skipped: true, error: "Recipient email is missing." };
    }
    if (dryRun()) {
      return {
        ok: true,
        providerMessageId: `DRY_RUN_EMAIL_${Date.now()}`,
        sanitizedResponse: { dryRun: true, bccCount: input.bcc?.length ?? 0 },
      };
    }
    if (!emailEnabled()) return { ok: false, error: "Email delivery is disabled." };
    try {
      const result = await transporter(config).sendMail({
        from: config.fromName
          ? {
              name: safeHeader(config.fromName, "Sender name"),
              address: safeHeader(config.fromEmail, "Sender email"),
            }
          : safeHeader(config.fromEmail, "Sender email"),
        to: input.recipientEmail ? safeHeader(input.recipientEmail, "Recipient email") : config.fromEmail,
        bcc: input.bcc?.map((addr) => safeHeader(addr, "BCC email")),
        subject: safeHeader(input.subject ?? "Freito notification", "Subject"),
        text: input.messageBody,
        html: input.htmlBody ?? undefined,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      return {
        ok: true,
        providerMessageId: result.messageId,
        sanitizedResponse: { accepted: result.accepted.length, rejected: result.rejected.length },
      };
    } catch {
      return { ok: false, error: "SMTP delivery failed." };
    }
  },
};
