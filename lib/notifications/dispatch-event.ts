import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { createClientPortalNotification, createUserNotification } from "@/lib/notifications/create-notification";
import { renderTemplate, safelyCreateCustomerDeliveries } from "@/lib/notifications/templates";
import { externalNotificationChannels } from "@/lib/notifications/template-definitions";
import { notificationEventDefinitions, type NotificationEventKey } from "@/lib/notifications/event-definitions";

type DispatchClient = Prisma.TransactionClient | typeof prisma;
type TemplateVariables = Record<string, string | number | null | undefined>;

function recipientKeyForUser(userId: string) {
  return `USER:${userId}`;
}

function recipientKeyForPortalAccount(clientPortalAccountId: string) {
  return `PORTAL:${clientPortalAccountId}`;
}

/** Resolves the customer's active client-portal account, if any, for use as `portalRecipientAccountId`. */
export async function resolveActivePortalAccountId({
  customerId,
  companyId,
  db = prisma,
}: {
  customerId: string;
  companyId: string;
  db?: DispatchClient;
}) {
  const account = await db.clientportalaccount.findFirst({
    where: { customerId, companyId, status: "ACTIVE", deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  return account?.id ?? null;
}

/** Resolves `/portal/{slug}{path}`, or null when the company has no portal slug configured. */
export async function resolvePortalLinkUrl({
  companyId,
  path,
  db = prisma,
}: {
  companyId: string;
  path: string;
  db?: DispatchClient;
}) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { portalSlug: true } });
  return company?.portalSlug ? `/portal/${company.portalSlug}${path}` : null;
}

/**
 * Fires a Phase 02 notification event: an in-app row for the internal
 * recipient, and (for customer-facing events) an in-app row plus outbox
 * entries for the shipment/invoice's own customer portal account.
 *
 * Every create is dedupe-key guarded, so retried/duplicate calls for the
 * same event+entity+recipient are no-ops rather than duplicate rows.
 * Outbox rows are always created PENDING when the template is active and the
 * recipient has not opted out -- autoSendApproved is checked later, only by
 * the scheduled dispatcher, never here.
 */
export async function dispatchNotificationEvent({
  eventKey,
  companyId,
  branchId,
  entityId,
  internalRecipientUserId,
  portalRecipientAccountId,
  variables,
  internalLinkUrl,
  portalLinkUrl,
  db = prisma,
}: {
  eventKey: NotificationEventKey;
  companyId: string;
  branchId?: string | null;
  entityId: string;
  internalRecipientUserId?: string | null;
  portalRecipientAccountId?: string | null;
  variables: TemplateVariables;
  internalLinkUrl?: string | null;
  portalLinkUrl?: string | null;
  db?: DispatchClient;
}) {
  const definition = notificationEventDefinitions[eventKey];
  if (!definition) throw new Error(`Unknown notification event key: ${eventKey}`);

  if (internalRecipientUserId) {
    await createUserNotification({
      companyId,
      userId: internalRecipientUserId,
      branchId,
      dedupeKey: `${eventKey}:${entityId}:${recipientKeyForUser(internalRecipientUserId)}`,
      type: eventKey.toUpperCase(),
      title: renderTemplate(definition.internalTitle, variables),
      message: renderTemplate(definition.internalMessage, variables),
      linkUrl: internalLinkUrl,
      db,
    });
  }

  if (definition.portal && portalRecipientAccountId) {
    const recipientKey = recipientKeyForPortalAccount(portalRecipientAccountId);
    const optOuts = await db.notificationoptout.findMany({
      where: { companyId, recipientKey },
      select: { channel: true },
    });
    const optedOutChannels = new Set(optOuts.map((row) => row.channel));

    if (!optedOutChannels.has("IN_APP")) {
      await createClientPortalNotification({
        companyId,
        clientPortalAccountId: portalRecipientAccountId,
        branchId,
        dedupeKey: `${eventKey}:${entityId}:${recipientKey}`,
        type: eventKey.toUpperCase(),
        title: renderTemplate(definition.portal.title, variables),
        message: renderTemplate(definition.portal.message, variables),
        linkUrl: portalLinkUrl,
        db,
      });
    }

    const excludeChannels = externalNotificationChannels.filter((channel) => optedOutChannels.has(channel));
    await safelyCreateCustomerDeliveries({
      companyId,
      clientPortalAccountId: portalRecipientAccountId,
      key: definition.portal.templateKey,
      variables,
      linkUrl: portalLinkUrl,
      branchId,
      excludeChannels,
      dedupeKeyForChannel: (channel) => `${eventKey}:${entityId}:${recipientKey}:${channel}`,
      db,
    });
  }
}
