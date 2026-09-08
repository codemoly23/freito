import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { createNotificationDeliveryFromTemplate } from "@/lib/notifications/templates";

export function hashPortalActivationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPortalActivationInvitation({
  companyId,
  customerId,
  clientPortalAccountId,
  resend = false,
}: {
  companyId: string;
  customerId: string;
  clientPortalAccountId: string;
  resend?: boolean;
}) {
  const account = await prisma.clientportalaccount.findFirst({
    where: { id: clientPortalAccountId, companyId, customerId, deletedAt: null },
    include: {
      customer: { select: { name: true } },
      company: { select: { name: true, portalDisplayName: true, portalSlug: true } },
    },
  });
  if (!account?.company.portalSlug) throw new Error("Portal account or company portal was not found.");

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customerportalactivationtoken.updateMany({
      where: { clientPortalAccountId, usedAt: null, deletedAt: null },
      data: { deletedAt: now, updatedAt: now },
    });
    await tx.customerportalactivationtoken.create({
      data: {
        id: randomBytes(16).toString("hex"),
        companyId,
        customerId,
        clientPortalAccountId,
        tokenHash: hashPortalActivationToken(token),
        expiresAt,
        updatedAt: now,
      },
    });
    await tx.clientportalaccount.update({
      where: { id: clientPortalAccountId },
      data: { status: "INVITED", mustChangePassword: true, updatedAt: now },
    });
  });

  const configuredAppUrl = process.env.PORTAL_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const appUrl = configuredAppUrl.replace("://127.0.0.1", "://localhost").replace(/\/$/, "");
  const activationPath = `/portal/${account.company.portalSlug}/activate?token=${encodeURIComponent(token)}`;
  const activationLink = `${appUrl}${activationPath}`;
  const portalLoginUrl = `${appUrl}/portal/${account.company.portalSlug}/login`;
  const variables = {
    customerName: account.customer.name,
    companyName: account.company.portalDisplayName ?? account.company.name,
    clientId: account.displayClientCode,
    oneTimePassword: account.plainPassword ?? "",
    activationLink,
    expiresAt: expiresAt.toLocaleString(),
    portalLoginUrl,
  };
  const prefix = resend ? "customer_portal_access_resend" : "customer_portal_access";
  const channels = [
    { channel: "EMAIL" as const, key: `${prefix}_email`, email: account.email, phone: null },
    { channel: "WHATSAPP" as const, key: `${prefix}_whatsapp`, email: null, phone: account.phone },
    { channel: "SMS" as const, key: `${prefix}_sms`, email: null, phone: account.phone },
  ];
  const deliveries = [];
  for (const item of channels) {
    const missingRecipient = item.channel === "EMAIL" ? !item.email : !item.phone;
    const delivery = await createNotificationDeliveryFromTemplate({
      companyId,
      key: item.key,
      channel: item.channel,
      scope: "CLIENT_PORTAL",
      variables,
      recipientClientPortalAccountId: account.id,
      recipientName: account.customer.name,
      recipientEmail: item.email,
      recipientPhone: item.phone,
      linkUrl: activationPath,
    });
    if (delivery && missingRecipient) {
      deliveries.push(await prisma.notificationdelivery.update({
        where: { id: delivery.id },
        data: {
          status: "SKIPPED",
          errorMessage: item.channel === "EMAIL" ? "Recipient email is missing." : "Recipient phone is missing.",
          updatedAt: new Date(),
        },
      }));
    } else {
      deliveries.push(delivery);
    }
  }
  return { activationLink, activationPath, expiresAt, deliveries: deliveries.filter(Boolean) };
}
