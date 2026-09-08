import type {
  communicationaccount_provider as CommunicationProvider,
  communicationaccount_channel as NotificationChannel,
} from "@/lib/generated/prisma/client";

export type EmailSmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromEmail: string;
  fromName?: string;
};

export type WhatsAppCloudConfig = {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId?: string;
  defaultLanguage: string;
};

export type SmsHttpConfig = {
  baseUrl: string;
  apiKey: string;
  senderId?: string;
  provider?: string;
};

export type ProviderConfig = EmailSmtpConfig | WhatsAppCloudConfig | SmsHttpConfig | Record<string, never>;

export type ProviderConnectionResult = {
  ok: boolean;
  error?: string;
};

export type ProviderSendInput = {
  channel: NotificationChannel;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  bcc?: string[];          // BCC recipients (used for vendor email blasts)
  subject?: string | null;
  messageBody: string;
  htmlBody?: string | null; // Optional HTML body (falls back to messageBody as text)
  templateKey?: string | null;
  templateLanguage?: string | null;
};

export type ProviderSendResult = {
  ok: boolean;
  skipped?: boolean;
  providerMessageId?: string;
  error?: string;
  sanitizedResponse?: Record<string, string | number | boolean | null>;
};

export interface CommunicationProviderAdapter<TConfig extends ProviderConfig> {
  provider: CommunicationProvider;
  channel: NotificationChannel;
  testConnection(config: TConfig): Promise<ProviderConnectionResult>;
  send(config: TConfig, input: ProviderSendInput): Promise<ProviderSendResult>;
}
