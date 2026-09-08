"use server";

import { revalidatePath } from "next/cache";
import { getScopedCompanyId, getString } from "@/lib/actions/helpers";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";

function companyRecipient(userId: string) {
  return { OR: [{ userId: null }, { userId }] };
}

export async function markCompanyNotificationRead(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("notifications:update");
  const id = getString(formData, "notificationId");
  await prisma.notification.updateMany({
    where: {
      id,
      companyId,
      scope: "COMPANY",
      deletedAt: null,
      ...companyRecipient(user.id),
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard/notifications");
}

export async function markAllCompanyNotificationsRead() {
  const { user, companyId } = await getScopedCompanyId("notifications:update");
  await prisma.notification.updateMany({
    where: {
      companyId,
      scope: "COMPANY",
      readAt: null,
      deletedAt: null,
      ...companyRecipient(user.id),
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/dashboard/notifications");
}

export async function deleteCompanyNotification(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("notifications:delete");
  const id = getString(formData, "notificationId");
  await prisma.notification.updateMany({
    where: {
      id,
      companyId,
      scope: "COMPANY",
      deletedAt: null,
      ...companyRecipient(user.id),
    },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/dashboard/notifications");
}

export async function markPortalNotificationRead(
  companySlug: string,
  formData: FormData,
) {
  const { account } = await requirePortalAccount(companySlug);
  const id = getString(formData, "notificationId");
  await prisma.notification.updateMany({
    where: {
      id,
      companyId: account.companyId,
      clientPortalAccountId: account.id,
      scope: "CLIENT_PORTAL",
      deletedAt: null,
    },
    data: { readAt: new Date() },
  });
  revalidatePath(`/portal/${companySlug}/notifications`);
}

export async function markAllPortalNotificationsRead(companySlug: string) {
  const { account } = await requirePortalAccount(companySlug);
  await prisma.notification.updateMany({
    where: {
      companyId: account.companyId,
      clientPortalAccountId: account.id,
      scope: "CLIENT_PORTAL",
      readAt: null,
      deletedAt: null,
    },
    data: { readAt: new Date() },
  });
  revalidatePath(`/portal/${companySlug}/notifications`);
}
