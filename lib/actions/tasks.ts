"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getBranchWriteScope } from "@/lib/access/branch-access";
import { createUserNotification } from "@/lib/notifications/create-notification";
import { hasPermission } from "@/lib/permissions/rbac";
import { taskCommentSchema, taskSchema } from "@/lib/validators/tasks";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

function safeReturnTo(value: string | null) {
  return value?.startsWith("/dashboard/") && !value.startsWith("//") ? value : null;
}

export async function validateTaskRelations(companyId: string, accessibleBranchIds: string[] | null, values: {
  assignedUserId: string | null;
  customerId: string | null;
  vendorId: string | null;
  shipmentJobId: string | null;
  quotationId: string | null;
  invoiceId: string | null;
  shipmentRequestId: string | null;
}) {
  const [assignee, customer, vendor, shipment, quotation, invoice, request] = await Promise.all([
    values.assignedUserId ? prisma.user.findFirst({ where: { id: values.assignedUserId, companyId, scope: "COMPANY", status: "ACTIVE", deletedAt: null }, select: { id: true } }) : null,
    values.customerId ? prisma.customer.findFirst({ where: { id: values.customerId, companyId, deletedAt: null }, select: { id: true } }) : null,
    values.vendorId ? prisma.vendor.findFirst({ where: { id: values.vendorId, companyId, deletedAt: null }, select: { id: true } }) : null,
    values.shipmentJobId ? prisma.shipmentjob.findFirst({ where: { id: values.shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { id: true, customerId: true } }) : null,
    values.quotationId ? prisma.quotation.findFirst({ where: { id: values.quotationId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { id: true, customerId: true, shipmentJobId: true, shipmentRequestId: true } }) : null,
    values.invoiceId ? prisma.invoice.findFirst({ where: { id: values.invoiceId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { id: true, customerId: true, shipmentJobId: true, quotationId: true } }) : null,
    values.shipmentRequestId ? prisma.shipmentrequest.findFirst({ where: { id: values.shipmentRequestId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { id: true, customerId: true, convertedShipmentJobId: true } }) : null,
  ]);
  if (values.assignedUserId && !assignee) return "Select a valid company assignee.";
  if (values.customerId && !customer) return "Select a valid customer.";
  if (values.vendorId && !vendor) return "Select a valid vendor.";
  if (values.shipmentJobId && !shipment) return "Select a valid shipment.";
  if (values.quotationId && !quotation) return "Select a valid quotation.";
  if (values.invoiceId && !invoice) return "Select a valid invoice.";
  if (values.shipmentRequestId && !request) return "Select a valid shipment request.";
  const linkedCustomerIds = [shipment?.customerId, quotation?.customerId, invoice?.customerId, request?.customerId].filter(Boolean);
  if (values.customerId && linkedCustomerIds.some((id) => id !== values.customerId)) return "Linked records must belong to the selected customer.";
  if (values.shipmentJobId && quotation?.shipmentJobId && quotation.shipmentJobId !== values.shipmentJobId) return "Quotation does not belong to the selected shipment.";
  if (values.shipmentJobId && invoice?.shipmentJobId && invoice.shipmentJobId !== values.shipmentJobId) return "Invoice does not belong to the selected shipment.";
  if (values.quotationId && invoice?.quotationId && invoice.quotationId !== values.quotationId) return "Invoice does not belong to the selected quotation.";
  if (values.shipmentRequestId && quotation?.shipmentRequestId && quotation.shipmentRequestId !== values.shipmentRequestId) return "Quotation does not belong to the selected request.";
  return null;
}

export async function saveTask(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId(getString(formData, "id") ? "tasks:edit" : "tasks:create");
  const { accessibleBranchIds, defaultBranchId } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const parsed = taskSchema.safeParse({
    id: getString(formData, "id"),
    title: getString(formData, "title"),
    description: getString(formData, "description"),
    status: getString(formData, "status") || "TODO",
    priority: getString(formData, "priority") || "MEDIUM",
    dueDate: getString(formData, "dueDate"),
    assignedUserId: getString(formData, "assignedUserId"),
    customerId: getString(formData, "customerId"),
    vendorId: getString(formData, "vendorId"),
    shipmentJobId: getString(formData, "shipmentJobId"),
    quotationId: getString(formData, "quotationId"),
    invoiceId: getString(formData, "invoiceId"),
    shipmentRequestId: getString(formData, "shipmentRequestId"),
    returnTo: getString(formData, "returnTo"),
  });
  if (!parsed.success) return validationError("Please fix the highlighted task fields.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;
  if (data.assignedUserId && !hasPermission(user, "tasks:assign")) return validationError("You do not have permission to assign tasks.");
  const relationError = await validateTaskRelations(companyId, accessibleBranchIds, data);
  if (relationError) return validationError(relationError);
  const dueDate = data.dueDate ? new Date(`${data.dueDate}T12:00:00`) : null;
  if (dueDate && Number.isNaN(dueDate.getTime())) return validationError("Enter a valid due date.");

  const existing = data.id ? await prisma.task.findFirst({ where: { id: data.id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } }) : null;
  if (data.id && !existing) return validationError("Task was not found.");
  const linkedBranch = data.shipmentJobId
    ? await prisma.shipmentjob.findFirst({ where: { id: data.shipmentJobId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { branchId: true } })
    : data.quotationId
      ? await prisma.quotation.findFirst({ where: { id: data.quotationId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { branchId: true } })
      : data.invoiceId
        ? await prisma.invoice.findFirst({ where: { id: data.invoiceId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { branchId: true } })
        : data.shipmentRequestId
          ? await prisma.shipmentrequest.findFirst({ where: { id: data.shipmentRequestId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { branchId: true } })
          : null;
  const branchId = existing?.branchId ?? linkedBranch?.branchId ?? defaultBranchId;
  if (!branchId) return validationError("Assign an active default branch before creating a task.");
  const taskData = {
    branchId,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    dueDate,
    assignedUserId: data.assignedUserId,
    customerId: data.customerId,
    vendorId: data.vendorId,
    shipmentJobId: data.shipmentJobId,
    quotationId: data.quotationId,
    invoiceId: data.invoiceId,
    shipmentRequestId: data.shipmentRequestId,
    completedAt: data.status === "DONE" ? existing?.completedAt ?? new Date() : null,
  };
  const task = existing
    ? await prisma.task.update({ where: { id: existing.id }, data: { ...taskData, updatedAt: new Date() } })
    : await prisma.task.create({ data: { id: randomUUID(), companyId, createdById: user.id, updatedAt: new Date(), ...taskData } });

  await audit({
    companyId,
    actorId: user.id,
    action: existing ? "TASK_UPDATED" : "TASK_CREATED",
    entityType: "Task",
    entityId: task.id,
    metadata: { title: task.title, status: task.status, priority: task.priority },
  });
  if (existing && existing.status !== task.status) {
    await audit({ companyId, actorId: user.id, action: "TASK_STATUS_CHANGED", entityType: "Task", entityId: task.id, metadata: { from: existing.status, to: task.status } });
  }
  if (existing?.assignedUserId !== task.assignedUserId && task.assignedUserId) {
    await audit({ companyId, actorId: user.id, action: "TASK_ASSIGNED", entityType: "Task", entityId: task.id, metadata: { from: existing?.assignedUserId ?? null, to: task.assignedUserId } });
  }
  if ((!existing || existing.assignedUserId !== task.assignedUserId) && task.assignedUserId && task.assignedUserId !== user.id) {
    await createUserNotification({ companyId, userId: task.assignedUserId, type: "TASK_ASSIGNED", title: "Task assigned", message: `${user.name ?? user.email} assigned you: ${task.title}`, linkUrl: `/dashboard/tasks/${task.id}`, metadata: { taskId: task.id } });
  } else if (existing && existing.dueDate?.getTime() !== task.dueDate?.getTime() && task.assignedUserId && task.assignedUserId !== user.id) {
    await createUserNotification({ companyId, userId: task.assignedUserId, type: "TASK_DUE_DATE_CHANGED", title: "Task due date changed", message: `The due date changed for: ${task.title}`, linkUrl: `/dashboard/tasks/${task.id}`, metadata: { taskId: task.id } });
  }
  if (existing && existing.status !== "DONE" && task.status === "DONE" && task.createdById !== user.id) {
    await createUserNotification({ companyId, userId: task.createdById, type: "TASK_COMPLETED", title: "Task completed", message: `${user.name ?? user.email} completed: ${task.title}`, linkUrl: `/dashboard/tasks/${task.id}`, metadata: { taskId: task.id } });
  }
  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${task.id}`);
  const returnTo = safeReturnTo(data.returnTo);
  redirect(returnTo ?? `/dashboard/tasks/${task.id}`);
}

export async function updateTaskStatus(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("tasks:edit");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const id = getString(formData, "id");
  const status = getString(formData, "status");
  if (!["TODO", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"].includes(status)) return;
  const existing = await prisma.task.findFirst({ where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } });
  if (!existing || existing.status === status) return;
  const task = await prisma.task.update({ where: { id }, data: { status: status as typeof existing.status, completedAt: status === "DONE" ? new Date() : null, updatedAt: new Date() } });
  await audit({ companyId, actorId: user.id, action: "TASK_STATUS_CHANGED", entityType: "Task", entityId: task.id, metadata: { from: existing.status, to: task.status } });
  if (status === "DONE" && task.createdById !== user.id) {
    await createUserNotification({ companyId, userId: task.createdById, type: "TASK_COMPLETED", title: "Task completed", message: `${user.name ?? user.email} completed: ${task.title}`, linkUrl: `/dashboard/tasks/${task.id}`, metadata: { taskId: task.id } });
  }
  revalidatePath("/dashboard/tasks");
  revalidatePath(`/dashboard/tasks/${task.id}`);
}

export async function addTaskComment(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("tasks:comment");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const parsed = taskCommentSchema.safeParse({ taskId: getString(formData, "taskId"), body: getString(formData, "body") });
  if (!parsed.success) return validationError("Comment is required.", parsed.error.flatten().fieldErrors);
  const task = await prisma.task.findFirst({ where: { id: parsed.data.taskId, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) }, select: { id: true } });
  if (!task) return validationError("Task was not found.");
  const comment = await prisma.taskcomment.create({ data: { id: randomUUID(), companyId, taskId: task.id, authorId: user.id, body: parsed.data.body, updatedAt: new Date() } });
  await audit({ companyId, actorId: user.id, action: "TASK_COMMENT_CREATED", entityType: "TaskComment", entityId: comment.id, metadata: { taskId: task.id } });
  revalidatePath(`/dashboard/tasks/${task.id}`);
  return successState("Comment added.");
}

export async function deleteTask(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("tasks:delete");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const id = getString(formData, "id");
  const task = await prisma.task.findFirst({ where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } });
  if (!task) return;
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date(), status: "CANCELLED", updatedAt: new Date() } });
  await audit({ companyId, actorId: user.id, action: "TASK_DELETED", entityType: "Task", entityId: task.id, metadata: { title: task.title } });
  revalidatePath("/dashboard/tasks");
  redirect("/dashboard/tasks");
}
