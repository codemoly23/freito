import type { Prisma } from "@/lib/generated/prisma/client";

const customerEventKeys = [
  "shipment_request_submitted",
  "quotation_created",
  "quotation_accepted",
  "quotation_rejected",
  "quotation_revision_requested",
  "shipment_created",
];

export function notificationDeliveryAccessWhere(user: { roles?: string[] }) {
  const roles = new Set(user.roles ?? []);
  if (roles.has("COMPANY_ADMIN") || roles.has("OPERATIONS_MANAGER")) {
    return {} satisfies Prisma.notificationdeliveryWhereInput;
  }
  if (roles.has("SALES_EXECUTIVE")) {
    return {
      notificationtemplate: { key: { in: customerEventKeys } },
    } satisfies Prisma.notificationdeliveryWhereInput;
  }
  if (roles.has("DOCUMENTATION_OFFICER")) {
    return {
      notificationtemplate: { key: { in: ["document_rejected", "workflow_step_assigned"] } },
    } satisfies Prisma.notificationdeliveryWhereInput;
  }
  if (roles.has("ACCOUNTS_OFFICER")) {
    return {
      notificationtemplate: { key: { startsWith: "invoice_" } },
    } satisfies Prisma.notificationdeliveryWhereInput;
  }
  return { id: "__no_delivery_access__" } satisfies Prisma.notificationdeliveryWhereInput;
}
