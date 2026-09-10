"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { rolePermissionSchema } from "@/lib/validators/admin";
import { SEED_ONLY_PERMISSION_KEYS } from "@/lib/permissions/seed-only-permissions";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  getStringArray,
  revalidateAdminPaths,
  successState,
  validationError,
} from "@/lib/actions/helpers";

const companySafePermissions = new Set([
  "dashboard:view",
  "ai:configure",
  "ai:use",
  "branding:manage",
  "branches:view",
  "branches:manage",
  "branches:access_all",
  "users:manage",
  "roles:manage",
  "customers:manage",
  "vendors:manage",
  "shipments:view",
  "shipments:create",
  "shipments:update",
  "shipments:delete",
  "shipments:status:update",
  "shipments:containers:manage",
  "shipments:view_assigned",
  "documents:view",
  "documents:upload",
  "documents:update",
  "documents:delete",
  "documents:verify",
  "documents:download",
  "documents:manage",
  "quotations:view",
  "quotations:create",
  "quotations:update",
  "quotations:delete",
  "quotations:approve",
  "quotations:convert",
  "costing:view",
  "costing:update",
  "costing:delete",
  "invoices:view",
  "invoices:create",
  "invoices:update",
  "invoices:delete",
  "invoices:send",
  "vendorBills:view",
  "vendorBills:create",
  "vendorBills:update",
  "vendorBills:delete",
  "payments:view",
  "payments:create",
  "payments:update",
  "payments:delete",
  "receivables:view",
  "payables:view",
  "ledgers:view",
  "accounts:manage",
  "sales:manage",
  "reports:view",
  "reports:financial",
  "reports:operations",
  "reports:export",
  "reports:accounting",
  "tasks:list",
  "tasks:view",
  "tasks:create",
  "tasks:edit",
  "tasks:delete",
  "tasks:comment",
  "tasks:assign",
  "carrierQueries:list", "carrierQueries:view", "carrierQueries:create", "carrierQueries:edit", "carrierQueries:delete",
  "carrierProposals:view", "carrierProposals:manage", "carrierProposals:select",
  "bookings:view", "bookings:manage",
  "shippingInstructions:view", "shippingInstructions:manage",
  "billOfLading:view", "billOfLading:manage", "billOfLading:lock",
  "preAlerts:view", "preAlerts:manage", "preAlerts:send",
  "releaseChecks:view", "releaseChecks:manage",
  "exports:print",
  "exports:pdf",
  "exports:csv",
  "imports:csv",
  "notifications:view",
  "notifications:update",
  "notifications:delete",
  "notificationTemplates:view",
  "notificationTemplates:manage",
  "notificationDeliveries:view",
  "notificationDeliveries:manage",
  "communicationAccounts:view",
  "communicationAccounts:manage",
  "communicationAccounts:connect",
  "communicationAccounts:test",
  "communicationAccounts:send",
  "share:view",
  "share:create",
  "share:send",
  "client_portal:view",
  "approvalPolicies:manage",
  "audit_logs:view",
  "clientPortalAccounts:view",
  "clientPortalAccounts:create",
  "clientPortalAccounts:update",
  "clientPortalAccounts:delete",
  "clientPortalAccounts:resetPassword",
  "companies:manage",
  "documentTemplates:manage",
  "payments:approve",
  "vendorBills:approve",
  "shipmentRequests:view",
  "shipmentRequests:create",
  "shipmentRequests:update",
  "shipmentRequests:delete",
  "shipmentRequests:quote",
  "shipmentRequests:convert",
  "shipmentWorkflow:view",
  "shipmentWorkflow:update",
  "shipmentWorkflow:assign",
  "shipmentWorkflow:delete",
]);

function canAssignPermission(
  actor: { roles: string[]; permissions: string[] },
  permissionKey: string,
) {
  return (
    companySafePermissions.has(permissionKey) &&
    actor.permissions.includes(permissionKey)
  );
}

export async function updateRolePermissions(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId: scopedCompanyId } =
    await getScopedCompanyId("roles:manage");

  const parsed = rolePermissionSchema.safeParse({
    roleId: getString(formData, "roleId"),
    permissionIds: getStringArray(formData, "permissionIds"),
  });

  if (!parsed.success) {
    return validationError(
      "Please select valid role permissions.",
      parsed.error.flatten().fieldErrors,
    );
  }

  const role = await prisma.role.findUniqueOrThrow({
    where: { id: parsed.data.roleId },
  });

  if (scopedCompanyId && role.companyId !== scopedCompanyId) {
    return validationError("You cannot manage roles for another company.");
  }

  const requestedPermissions = await prisma.permission.findMany({
    where: { id: { in: parsed.data.permissionIds } },
    select: { id: true, key: true },
  });

  if (requestedPermissions.length !== parsed.data.permissionIds.length) {
    return validationError("One or more selected permissions are invalid.");
  }

  const deniedPermission = requestedPermissions.find(
    (permission) => !canAssignPermission(user, permission.key),
  );

  if (deniedPermission) {
    return validationError(
      `You cannot assign the ${deniedPermission.key} permission.`,
    );
  }

  // This form only ever offers company-admin-assignable permissions as
  // checkboxes (companySafePermissions), so a plain "wipe and recreate from
  // the submitted list" would silently strip any seed-only grant (e.g.
  // companies:switch) the role already holds. Preserve those by unioning
  // them back in — they were never part of what this save is allowed to
  // change in the first place.
  const existingRolePermissions = await prisma.rolepermission.findMany({
    where: { roleId: role.id },
    select: { permissionId: true, permission: { select: { key: true } } },
  });
  const preservedPermissionIds = existingRolePermissions
    .filter((rp) => !companySafePermissions.has(rp.permission.key))
    .map((rp) => rp.permissionId);
  const finalPermissionIds = [...new Set([...parsed.data.permissionIds, ...preservedPermissionIds])];

  // Refuse to let an admin strip "roles:manage" from the very role they're
  // currently signed in as -- that would lock them out of this page with no
  // in-app way back in (would need a direct database fix). Editing another
  // role's roles:manage grant is unaffected.
  const rolesManageRow = existingRolePermissions.find((rp) => rp.permission.key === "roles:manage");
  const actorHoldsThisRole = user.roles?.includes(role.code) ?? false;
  if (rolesManageRow && actorHoldsThisRole && !finalPermissionIds.includes(rolesManageRow.permissionId)) {
    return validationError(
      'You cannot remove "roles:manage" from your own current role -- this would lock you out of Roles & Permissions. Ask another admin with this permission to make the change instead.',
    );
  }

  await prisma.role.update({
    where: { id: role.id },
    data: {
      updatedAt: new Date(),
      rolepermission: {
        deleteMany: {},
        create: finalPermissionIds.map((permissionId) => ({
          id: randomUUID(),
          permissionId,
        })),
      },
    },
  });

  await audit({
    companyId: role.companyId,
    actorId: user.id,
    action: "role.permissions_updated",
    entityType: "Role",
    entityId: role.id,
    metadata: { code: role.code },
  });

  revalidateAdminPaths();
  return successState("Role permissions updated.");
}
