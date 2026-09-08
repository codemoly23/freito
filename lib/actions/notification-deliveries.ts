"use server";

import { revalidatePath } from "next/cache";
import { audit, getScopedCompanyId, getString } from "@/lib/actions/helpers";
import { prisma } from "@/lib/db/prisma";
import { runNotificationDelivery } from "@/lib/notifications/delivery-runner";

export async function updateNotificationDeliveryStatus(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("notificationDeliveries:manage");
  const deliveryId = getString(formData, "deliveryId");
  const action = getString(formData, "action");
  const delivery = await prisma.notificationdelivery.findFirst({
    where: { id: deliveryId, companyId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!delivery) return;

  const now = new Date();
  const data =
    action === "CANCEL" && ["PENDING", "FAILED"].includes(delivery.status)
      ? { status: "CANCELLED" as const, errorMessage: null, failedAt: null, updatedAt: now }
      : action === "RESET" && delivery.status === "FAILED"
        ? {
            status: "PENDING" as const,
            errorMessage: null,
            failedAt: null,
            nextAttemptAt: null,
            updatedAt: now,
          }
        : action === "MARK_SENT" && ["PENDING", "FAILED"].includes(delivery.status)
          ? {
              status: "SENT" as const,
              sentAt: now,
              failedAt: null,
              errorMessage: null,
              updatedAt: now,
            }
          : null;
  if (!data) return;

  await prisma.notificationdelivery.updateMany({
    where: { id: delivery.id, companyId, deletedAt: null },
    data,
  });
  await audit({
    companyId,
    actorId: user.id,
    action: "NOTIFICATION_DELIVERY_STATUS_UPDATED",
    entityType: "NotificationDelivery",
    entityId: delivery.id,
    metadata: { from: delivery.status, action },
  });
  revalidatePath("/dashboard/notification-deliveries");
}

export async function sendNotificationDeliveryNow(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("communicationAccounts:send");
  const deliveryId = getString(formData, "deliveryId");
  const communicationAccountId = getString(formData, "communicationAccountId") || null;
  try {
    const result = await runNotificationDelivery({
      companyId,
      deliveryId,
      communicationAccountId,
    });
    await audit({
      companyId,
      actorId: user.id,
      action: "NOTIFICATION_DELIVERY_SEND_REQUESTED",
      entityType: "NotificationDelivery",
      entityId: deliveryId,
      metadata: {
        communicationAccountId,
        ok: result.ok,
        skipped: Boolean(result.skipped),
      },
    });
  } catch (error) {
    await prisma.notificationdelivery.updateMany({
      where: {
        id: deliveryId,
        companyId,
        status: { in: ["PENDING", "PROCESSING", "FAILED"] },
        deletedAt: null,
      },
      data: {
        status: "FAILED",
        failedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Delivery failed.",
        updatedAt: new Date(),
      },
    });
  }
  revalidatePath("/dashboard/notification-deliveries");
}
