import "server-only";
import crypto from "crypto";
import type {
  notificationdelivery_channel as NotificationChannel,
  notificationdelivery_scope as NotificationScope,
  Prisma,
} from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { customerSafeTemplateVariables } from "@/lib/notifications/template-definitions";
import { externalNotificationChannels } from "@/lib/notifications/template-definitions";

type NotificationClient = Prisma.TransactionClient | typeof prisma;
type TemplateVariables = Record<string, string | number | null | undefined>;

const variablePattern = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;
const customerSafeVariableSet = new Set<string>(customerSafeTemplateVariables);

function safeLink(linkUrl?: string | null) {
  if (!linkUrl) return null;
  if (!linkUrl.startsWith("/") || linkUrl.startsWith("//")) {
    throw new Error("Notification delivery links must be internal application paths.");
  }
  return linkUrl;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export function validateTemplateVariables(
  template: { subject?: string | null; body: string },
  variables: TemplateVariables,
) {
  const required = new Set<string>();
  for (const content of [template.subject ?? "", template.body]) {
    for (const match of content.matchAll(variablePattern)) required.add(match[1]);
  }
  return [...required].filter((key) => variables[key] === undefined || variables[key] === null);
}

export function renderTemplate(content: string, variables: TemplateVariables) {
  return content.replace(variablePattern, (_match, key: string) =>
    variables[key] === undefined || variables[key] === null ? "" : String(variables[key]),
  );
}

function assertCustomerSafeVariables(variables: TemplateVariables) {
  const unsafe = Object.keys(variables).filter((key) => !customerSafeVariableSet.has(key));
  if (unsafe.length) {
    throw new Error(`Customer delivery variables are not allowed: ${unsafe.join(", ")}.`);
  }
}

export async function createNotificationDeliveryFromTemplate({
  companyId,
  key,
  channel,
  scope,
  variables,
  notificationId,
  recipientUserId,
  recipientClientPortalAccountId,
  recipientName,
  recipientEmail,
  recipientPhone,
  linkUrl,
  branchId,
  dedupeKey,
  db = prisma,
}: {
  companyId: string;
  key: string;
  channel: Exclude<NotificationChannel, "IN_APP">;
  scope: NotificationScope;
  variables: TemplateVariables;
  notificationId?: string | null;
  recipientUserId?: string | null;
  recipientClientPortalAccountId?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  linkUrl?: string | null;
  branchId?: string | null;
  dedupeKey?: string;
  db?: NotificationClient;
}) {
  if (scope === "CLIENT_PORTAL") assertCustomerSafeVariables(variables);

  const template = await db.notificationtemplate.findFirst({
    where: {
      key,
      channel,
      deletedAt: null,
      OR: [{ companyId }, { companyId: null, isSystem: true }],
    },
    orderBy: { companyId: "desc" },
  });
  if (!template || !template.isActive) return null;

  const missing = validateTemplateVariables(template, variables);
  if (missing.length) {
    throw new Error(`Missing notification template variables: ${missing.join(", ")}.`);
  }

  const deliveryLink = safeLink(linkUrl);
  const data = {
    id: crypto.randomUUID(),
    companyId,
    notificationId,
    templateId: template.id,
    branchId: branchId ?? null,
    dedupeKey,
    scope,
    channel,
    status: "PENDING" as const,
    recipientUserId,
    recipientClientPortalAccountId,
    recipientName,
    recipientEmail,
    recipientPhone,
    subject: template.subject ? renderTemplate(template.subject, variables) : null,
    messageBody: renderTemplate(template.body, variables),
    linkUrl: deliveryLink,
    updatedAt: new Date(),
  };

  if (!dedupeKey) return db.notificationdelivery.create({ data });

  try {
    return await db.notificationdelivery.create({ data });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await db.notificationdelivery.findFirst({ where: { dedupeKey } });
    if (existing) return existing;
    throw error;
  }
}

export async function safelyCreateNotificationDelivery(
  input: Parameters<typeof createNotificationDeliveryFromTemplate>[0],
) {
  try {
    return await createNotificationDeliveryFromTemplate(input);
  } catch (error) {
    console.error("Notification delivery outbox creation failed.", {
      key: input.key,
      channel: input.channel,
      scope: input.scope,
      companyId: input.companyId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}

export async function safelyCreateCustomerDeliveries({
  companyId,
  clientPortalAccountId,
  key,
  variables,
  linkUrl,
  notificationId,
  branchId,
  dedupeKeyForChannel,
  excludeChannels,
  db = prisma,
}: {
  companyId: string;
  clientPortalAccountId: string;
  key: string;
  variables: TemplateVariables;
  linkUrl?: string | null;
  notificationId?: string | null;
  branchId?: string | null;
  /** When provided, each channel's delivery row gets its own dedupeKey and duplicates are skipped instead of thrown. */
  dedupeKeyForChannel?: (channel: (typeof externalNotificationChannels)[number]) => string;
  /** Channels to skip entirely (e.g. a recipient opt-out), in addition to the usual missing-contact-info skip. */
  excludeChannels?: readonly (typeof externalNotificationChannels)[number][];
  db?: NotificationClient;
}) {
  try {
    const account = await db.clientportalaccount.findFirst({
      where: {
        id: clientPortalAccountId,
        companyId,
        status: "ACTIVE",
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        customer: { select: { name: true, email: true, phone: true } },
        company: { select: { name: true } },
      },
    });
    if (!account) return [];

    const recipientEmail = account.email ?? account.customer.email;
    const recipientPhone = account.phone ?? account.customer.phone;
    const safeVariables = {
      customerName: account.customer.name,
      companyName: account.company.name,
      requestNumber: "",
      quotationNumber: "",
      shipmentNumber: "",
      status: "",
      linkUrl: linkUrl ?? "",
      ...variables,
    };
    const deliveries = [];
    for (const channel of externalNotificationChannels) {
      if (excludeChannels?.includes(channel)) continue;
      if (channel === "EMAIL" && !recipientEmail) continue;
      if (channel === "WHATSAPP" && !recipientPhone) continue;
      deliveries.push(
        await safelyCreateNotificationDelivery({
          companyId,
          key,
          channel,
          scope: "CLIENT_PORTAL",
          variables: safeVariables,
          notificationId,
          recipientClientPortalAccountId: account.id,
          recipientName: account.customer.name,
          recipientEmail: channel === "EMAIL" ? recipientEmail : null,
          recipientPhone: channel === "WHATSAPP" ? recipientPhone : null,
          linkUrl,
          branchId,
          dedupeKey: dedupeKeyForChannel?.(channel),
          db,
        }),
      );
    }
    return deliveries.filter(Boolean);
  } catch (error) {
    console.error("Customer notification delivery preparation failed.", {
      companyId,
      clientPortalAccountId,
      key,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

export async function safelyCreateUserDeliveries({
  companyId,
  userId,
  key,
  variables,
  linkUrl,
  notificationId,
  branchId,
  dedupeKeyForChannel,
  db = prisma,
}: {
  companyId: string;
  userId: string;
  key: string;
  variables: TemplateVariables;
  linkUrl?: string | null;
  notificationId?: string | null;
  branchId?: string | null;
  /** When provided, each channel's delivery row gets its own dedupeKey and duplicates are skipped instead of thrown. */
  dedupeKeyForChannel?: (channel: (typeof externalNotificationChannels)[number]) => string;
  db?: NotificationClient;
}) {
  try {
    const user = await db.user.findFirst({
      where: { id: userId, companyId, scope: "COMPANY", status: "ACTIVE", deletedAt: null },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!user) return [];
    const deliveries = [];
    if (user.email) {
      deliveries.push(await safelyCreateNotificationDelivery({
        companyId,
        key,
        channel: "EMAIL",
        scope: "COMPANY",
        variables,
        notificationId,
        recipientUserId: user.id,
        recipientName: user.name,
        recipientEmail: user.email,
        linkUrl,
        branchId,
        dedupeKey: dedupeKeyForChannel?.("EMAIL"),
        db,
      }));
    }
    if (user.phone) {
      deliveries.push(await safelyCreateNotificationDelivery({
        companyId,
        key,
        channel: "WHATSAPP",
        scope: "COMPANY",
        variables,
        notificationId,
        recipientUserId: user.id,
        recipientName: user.name,
        recipientPhone: user.phone,
        linkUrl,
        branchId,
        dedupeKey: dedupeKeyForChannel?.("WHATSAPP"),
        db,
      }));
    }
    return deliveries.filter(Boolean);
  } catch (error) {
    console.error("Internal notification delivery preparation failed.", {
      companyId,
      userId,
      key,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}
