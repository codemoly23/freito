"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { audit, getScopedCompanyId, getString } from "@/lib/actions/helpers";
import { prisma } from "@/lib/db/prisma";
import { buildInternalShareLink, sanitizeShareMessage } from "@/lib/share/share-links";
import { branchScopeWhere, getCurrentBranchScope } from "@/lib/access/branch-access";

async function getShareTarget(companyId: string, resourceType: string, resourceId: string) {
  const branchWhere = branchScopeWhere(await getCurrentBranchScope(companyId));
  const company = await prisma.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { name: true, portalSlug: true } });
  if (!company?.portalSlug) return null;
  if (resourceType === "quotation") {
    const record = await prisma.quotation.findFirst({ where: { id: resourceId, companyId, deletedAt: null, ...branchWhere }, include: { customer: true } });
    if (!record) return null;
    return { customer: record.customer, title: `Quotation ${record.quoteNo}`, path: `/portal/${company.portalSlug}/quotations/${record.id}` };
  }
  if (resourceType === "invoice") {
    const record = await prisma.invoice.findFirst({ where: { id: resourceId, companyId, deletedAt: null, ...branchWhere }, include: { customer: true } });
    if (!record) return null;
    return { customer: record.customer, title: `Invoice ${record.invoiceNo}`, path: `/portal/${company.portalSlug}` };
  }
  if (resourceType === "request") {
    const record = await prisma.shipmentrequest.findFirst({ where: { id: resourceId, companyId, deletedAt: null, ...branchWhere }, include: { customer: true } });
    if (!record) return null;
    return { customer: record.customer, title: `Shipment request ${record.requestNo}`, path: `/portal/${company.portalSlug}/requests/${record.id}` };
  }
  if (resourceType === "shipment") {
    const record = await prisma.shipmentjob.findFirst({ where: { id: resourceId, companyId, deletedAt: null, ...branchWhere }, include: { customer: true, shipmentrequest: { select: { id: true } } } });
    if (!record) return null;
    return { customer: record.customer, title: `Shipment ${record.jobNo}`, path: record.shipmentrequest ? `/portal/${company.portalSlug}/requests/${record.shipmentrequest.id}` : `/portal/${company.portalSlug}` };
  }
  return null;
}

export async function createShareOutbox(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("share:create");
  const resourceType = getString(formData, "resourceType");
  const resourceId = getString(formData, "resourceId");
  const channel = getString(formData, "channel");
  if (!["EMAIL", "WHATSAPP"].includes(channel)) return;
  const target = await getShareTarget(companyId, resourceType, resourceId);
  if (!target) return;
  const linkUrl = target.path;
  const messageBody = sanitizeShareMessage(`${target.title} is available from your secure client portal: ${buildInternalShareLink(linkUrl)}`);
  const missingRecipient = channel === "EMAIL" ? !target.customer.email : !target.customer.phone;
  const template = await prisma.notificationtemplate.findFirst({
    where: {
      key: channel === "EMAIL" ? "client_share_email" : "client_share_whatsapp",
      channel: channel as "EMAIL" | "WHATSAPP",
      deletedAt: null,
      OR: [{ companyId }, { companyId: null, isSystem: true }],
    },
    orderBy: { companyId: "desc" },
    select: { id: true },
  });
  const now = new Date();
  await prisma.notificationdelivery.create({
    data: {
      id: randomUUID(),
      companyId,
      templateId: template?.id,
      scope: "CLIENT_PORTAL",
      channel: channel as "EMAIL" | "WHATSAPP",
      status: missingRecipient ? "SKIPPED" : "PENDING",
      recipientName: target.customer.name,
      recipientEmail: channel === "EMAIL" ? target.customer.email : null,
      recipientPhone: channel === "WHATSAPP" ? target.customer.phone : null,
      subject: channel === "EMAIL" ? target.title : null,
      messageBody,
      linkUrl,
      errorMessage: channel === "EMAIL" && !target.customer.email ? "Recipient email is missing." : channel === "WHATSAPP" && !target.customer.phone ? "Recipient phone is missing." : null,
      updatedAt: now,
    },
  });
  await audit({ companyId, actorId: user.id, action: "SHARE_OUTBOX_CREATED", entityType: resourceType, entityId: resourceId, metadata: { channel } });
  revalidatePath("/dashboard/notification-deliveries");
}
