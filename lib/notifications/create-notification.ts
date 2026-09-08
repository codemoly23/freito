import "server-only";
import crypto from "crypto";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

type NotificationClient = Prisma.TransactionClient | typeof prisma;

// MariaDB does not support `skipDuplicates` on `createMany` (Prisma limitation
// for MySQL-family connectors), so a dedupe-aware fan-out must insert rows one
// at a time and rely on the `dedupeKey` unique constraint plus a P2002 catch.
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

type NotificationInput = {
  type: string;
  title: string;
  message: string;
  linkUrl?: string | null;
  metadata?: Prisma.InputJsonValue;
  branchId?: string | null;
};

function safeLink(linkUrl?: string | null) {
  if (!linkUrl) return null;
  if (!linkUrl.startsWith("/") || linkUrl.startsWith("//")) {
    throw new Error("Notification links must be internal application paths.");
  }
  return linkUrl;
}

export async function createCompanyNotification({
  companyId,
  db = prisma,
  dedupeKeyForUserId,
  ...input
}: NotificationInput & {
  companyId: string;
  db?: NotificationClient;
  /** When provided, each fan-out row gets its own dedupeKey and duplicates are skipped instead of thrown. */
  dedupeKeyForUserId?: (userId: string) => string;
}) {
  const company = await db.company.findFirst({
    where: { id: companyId, deletedAt: null },
    select: { id: true },
  });
  if (!company) throw new Error("Notification company was not found.");

  const recipients = await db.user.findMany({
    where: {
      companyId,
      scope: "COMPANY",
      status: "ACTIVE",
      deletedAt: null,
      userrole: {
        some: {
          role: {
            rolepermission: {
              some: { permission: { key: "notifications:view" } },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  if (!recipients.length) return { count: 0 };

  const now = new Date();

  if (!dedupeKeyForUserId) {
    return db.notification.createMany({
      data: recipients.map((recipient) => ({
        id: crypto.randomUUID(),
        companyId,
        userId: recipient.id,
        branchId: input.branchId ?? null,
        scope: "COMPANY" as const,
        type: input.type,
        title: input.title,
        message: input.message,
        linkUrl: safeLink(input.linkUrl),
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        updatedAt: now,
      })),
    });
  }

  let count = 0;
  for (const recipient of recipients) {
    try {
      await db.notification.create({
        data: {
          id: crypto.randomUUID(),
          companyId,
          userId: recipient.id,
          branchId: input.branchId ?? null,
          dedupeKey: dedupeKeyForUserId(recipient.id),
          scope: "COMPANY" as const,
          type: input.type,
          title: input.title,
          message: input.message,
          linkUrl: safeLink(input.linkUrl),
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          updatedAt: now,
        },
      });
      count += 1;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }
  return { count };
}

export async function createUserNotification({
  companyId,
  userId,
  db = prisma,
  dedupeKey,
  ...input
}: NotificationInput & {
  companyId: string;
  userId: string;
  db?: NotificationClient;
  dedupeKey?: string;
}) {
  const user = await db.user.findFirst({
    where: {
      id: userId,
      companyId,
      scope: "COMPANY",
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!user) throw new Error("Notification user does not belong to this company.");

  const data = {
    id: crypto.randomUUID(),
    companyId,
    userId,
    branchId: input.branchId ?? null,
    dedupeKey,
    scope: "COMPANY" as const,
    type: input.type,
    title: input.title,
    message: input.message,
    linkUrl: safeLink(input.linkUrl),
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    updatedAt: new Date(),
  };

  if (!dedupeKey) return db.notification.create({ data });

  try {
    return await db.notification.create({ data });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await db.notification.findFirst({ where: { dedupeKey } });
    if (existing) return existing;
    throw error;
  }
}

export async function createClientPortalNotification({
  companyId,
  clientPortalAccountId,
  db = prisma,
  dedupeKey,
  ...input
}: Omit<NotificationInput, "metadata"> & {
  companyId: string;
  clientPortalAccountId: string;
  db?: NotificationClient;
  dedupeKey?: string;
}) {
  const account = await db.clientportalaccount.findFirst({
    where: {
      id: clientPortalAccountId,
      companyId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!account) {
    throw new Error("Portal notification account does not belong to this company.");
  }

  const data = {
    id: crypto.randomUUID(),
    companyId,
    clientPortalAccountId,
    branchId: input.branchId ?? null,
    dedupeKey,
    scope: "CLIENT_PORTAL" as const,
    type: input.type,
    title: input.title,
    message: input.message,
    linkUrl: safeLink(input.linkUrl),
    updatedAt: new Date(),
  };

  if (!dedupeKey) return db.notification.create({ data });

  try {
    return await db.notification.create({ data });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await db.notification.findFirst({ where: { dedupeKey } });
    if (existing) return existing;
    throw error;
  }
}
