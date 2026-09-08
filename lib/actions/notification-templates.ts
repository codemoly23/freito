"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { audit, getScopedCompanyId, getString } from "@/lib/actions/helpers";
import { prisma } from "@/lib/db/prisma";

export async function toggleNotificationTemplate(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("notificationTemplates:manage");
  const templateId = getString(formData, "templateId");
  const template = await prisma.notificationtemplate.findFirst({
    where: {
      id: templateId,
      deletedAt: null,
      OR: [{ companyId }, { companyId: null, isSystem: true }],
    },
  });
  if (!template) return;

  const isActive = !template.isActive;
  const now = new Date();
  if (template.companyId === companyId) {
    await prisma.notificationtemplate.update({
      where: { id: template.id },
      data: { isActive, updatedAt: now },
    });
  } else {
    await prisma.notificationtemplate.upsert({
      where: {
        companyId_key_channel: {
          companyId,
          key: template.key,
          channel: template.channel,
        },
      },
      update: {
        name: template.name,
        description: template.description,
        audienceScope: template.audienceScope,
        subject: template.subject,
        body: template.body,
        isActive,
        deletedAt: null,
        updatedAt: now,
      },
      create: {
        id: randomUUID(),
        companyId,
        key: template.key,
        name: template.name,
        description: template.description,
        channel: template.channel,
        audienceScope: template.audienceScope,
        subject: template.subject,
        body: template.body,
        isSystem: false,
        isActive,
        updatedAt: now,
      },
    });
  }
  await audit({
    companyId,
    actorId: user.id,
    action: "NOTIFICATION_TEMPLATE_TOGGLED",
    entityType: "NotificationTemplate",
    entityId: template.id,
    metadata: { key: template.key, channel: template.channel, isActive },
  });
  revalidatePath("/dashboard/notification-templates");
}

// Auto-send approval can only ever land on a company-scoped override row --
// never on the isSystem row -- so this always copy-on-writes into an override,
// same as toggleNotificationTemplate above. The scheduled dispatch endpoint
// additionally hard-filters on isSystem: false as defense in depth.
export async function toggleNotificationTemplateAutoSend(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("notificationTemplates:manage");
  const templateId = getString(formData, "templateId");
  const template = await prisma.notificationtemplate.findFirst({
    where: {
      id: templateId,
      deletedAt: null,
      OR: [{ companyId }, { companyId: null, isSystem: true }],
    },
  });
  if (!template) return;

  const autoSendApproved = !template.autoSendApproved;
  const now = new Date();
  if (template.companyId === companyId) {
    await prisma.notificationtemplate.update({
      where: { id: template.id },
      data: { autoSendApproved, updatedAt: now },
    });
  } else {
    await prisma.notificationtemplate.upsert({
      where: {
        companyId_key_channel: {
          companyId,
          key: template.key,
          channel: template.channel,
        },
      },
      update: {
        name: template.name,
        description: template.description,
        audienceScope: template.audienceScope,
        subject: template.subject,
        body: template.body,
        isActive: template.isActive,
        autoSendApproved,
        deletedAt: null,
        updatedAt: now,
      },
      create: {
        id: randomUUID(),
        companyId,
        key: template.key,
        name: template.name,
        description: template.description,
        channel: template.channel,
        audienceScope: template.audienceScope,
        subject: template.subject,
        body: template.body,
        isSystem: false,
        isActive: template.isActive,
        autoSendApproved,
        updatedAt: now,
      },
    });
  }
  await audit({
    companyId,
    actorId: user.id,
    action: "NOTIFICATION_TEMPLATE_AUTO_SEND_TOGGLED",
    entityType: "NotificationTemplate",
    entityId: template.id,
    metadata: { key: template.key, channel: template.channel, autoSendApproved },
  });
  revalidatePath("/dashboard/notification-templates");
}
