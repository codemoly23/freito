"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getBranchWriteScope } from "@/lib/access/branch-access";
import { validateTaskRelations } from "@/lib/actions/tasks";
import { calendarDateToOccurrenceInstant, isValidIanaTimezone } from "@/lib/recurring-tasks/schedule";
import { processDueRecurrence } from "@/lib/recurring-tasks/runner";
import { taskRecurrenceSchema } from "@/lib/validators/task-recurrences";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  validationError,
} from "@/lib/actions/helpers";

export async function saveTaskRecurrence(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const id = getString(formData, "id") || undefined;
  const { user, companyId } = await getScopedCompanyId(id ? "tasks:edit" : "tasks:create");
  const { accessibleBranchIds, defaultBranchId } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });

  const parsed = taskRecurrenceSchema.safeParse({
    id,
    title: getString(formData, "title"),
    description: getString(formData, "description"),
    priority: getString(formData, "priority") || "MEDIUM",
    assignedUserId: getString(formData, "assignedUserId"),
    customerId: getString(formData, "customerId"),
    vendorId: getString(formData, "vendorId"),
    shipmentJobId: getString(formData, "shipmentJobId"),
    quotationId: getString(formData, "quotationId"),
    invoiceId: getString(formData, "invoiceId"),
    shipmentRequestId: getString(formData, "shipmentRequestId"),
    frequency: getString(formData, "frequency") || "DAILY",
    interval: getString(formData, "interval") || "1",
    timezone: getString(formData, "timezone"),
    startDate: getString(formData, "startDate"),
    endDate: getString(formData, "endDate"),
    dueInDays: getString(formData, "dueInDays") || "0",
  });
  if (!parsed.success) return validationError("Please fix the highlighted fields.", parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  if (!isValidIanaTimezone(data.timezone)) return validationError("Enter a valid IANA timezone (e.g. Asia/Dhaka).");
  if (data.endDate && data.endDate < data.startDate) return validationError("End date cannot be before the start date.");

  const relationError = await validateTaskRelations(companyId, accessibleBranchIds, {
    assignedUserId: data.assignedUserId,
    customerId: data.customerId,
    vendorId: data.vendorId,
    shipmentJobId: data.shipmentJobId,
    quotationId: data.quotationId,
    invoiceId: data.invoiceId,
    shipmentRequestId: data.shipmentRequestId,
  });
  if (relationError) return validationError(relationError);

  const existing = data.id
    ? await prisma.taskrecurrence.findFirst({ where: { id: data.id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } })
    : null;
  if (data.id && !existing) return validationError("Recurrence was not found.");

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
  if (!branchId) return validationError("Assign an active default branch before creating a recurrence.");

  const startDateInstant = calendarDateToOccurrenceInstant(data.startDate, data.timezone);
  const endDateInstant = data.endDate ? calendarDateToOccurrenceInstant(data.endDate, data.timezone) : null;

  const templateData = {
    branchId,
    title: data.title,
    description: data.description,
    priority: data.priority,
    assignedUserId: data.assignedUserId,
    customerId: data.customerId,
    vendorId: data.vendorId,
    shipmentJobId: data.shipmentJobId,
    quotationId: data.quotationId,
    invoiceId: data.invoiceId,
    shipmentRequestId: data.shipmentRequestId,
    frequency: data.frequency,
    interval: data.interval,
    timezone: data.timezone,
    startDate: startDateInstant,
    endDate: endDateInstant,
    dueInDays: data.dueInDays,
  };

  const recurrence = existing
    ? // Editing template fields never disturbs an in-flight schedule --
      // nextRunAt/lastRunAt are intentionally left untouched here.
      await prisma.taskrecurrence.update({ where: { id: existing.id }, data: { ...templateData, updatedAt: new Date() } })
    : await prisma.taskrecurrence.create({
        data: {
          id: randomUUID(),
          companyId,
          createdById: user.id,
          isActive: true,
          nextRunAt: startDateInstant,
          updatedAt: new Date(),
          ...templateData,
        },
      });

  await audit({
    companyId,
    actorId: user.id,
    action: existing ? "TASK_RECURRENCE_UPDATED" : "TASK_RECURRENCE_CREATED",
    entityType: "TaskRecurrence",
    entityId: recurrence.id,
    metadata: { title: recurrence.title, frequency: recurrence.frequency, interval: recurrence.interval },
  });
  revalidatePath("/dashboard/task-recurrences");
  redirect(`/dashboard/task-recurrences/${recurrence.id}`);
}

export async function toggleTaskRecurrenceActive(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("tasks:edit");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const id = getString(formData, "id");
  const recurrence = await prisma.taskrecurrence.findFirst({ where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } });
  if (!recurrence) return;
  const isActive = !recurrence.isActive;
  await prisma.taskrecurrence.update({ where: { id }, data: { isActive, updatedAt: new Date() } });
  await audit({ companyId, actorId: user.id, action: isActive ? "TASK_RECURRENCE_RESUMED" : "TASK_RECURRENCE_PAUSED", entityType: "TaskRecurrence", entityId: id, metadata: { title: recurrence.title } });
  revalidatePath("/dashboard/task-recurrences");
  revalidatePath(`/dashboard/task-recurrences/${id}`);
}

export async function deleteTaskRecurrence(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("tasks:delete");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const id = getString(formData, "id");
  const recurrence = await prisma.taskrecurrence.findFirst({ where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } });
  if (!recurrence) return;
  await prisma.taskrecurrence.update({ where: { id }, data: { deletedAt: new Date(), isActive: false, updatedAt: new Date() } });
  await audit({ companyId, actorId: user.id, action: "TASK_RECURRENCE_DELETED", entityType: "TaskRecurrence", entityId: id, metadata: { title: recurrence.title } });
  revalidatePath("/dashboard/task-recurrences");
  redirect("/dashboard/task-recurrences");
}

// Manual recovery action: lets an admin process one recurrence immediately
// without waiting for the next cron tick (e.g. cron is misconfigured, or a
// backlog needs to be cleared right away). Reuses the exact same
// idempotent/crash-safe generation logic the protected cron endpoint uses.
export async function runTaskRecurrenceNow(formData: FormData) {
  const { user, companyId } = await getScopedCompanyId("tasks:edit");
  const { accessibleBranchIds } = await getBranchWriteScope({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const id = getString(formData, "id");
  const recurrence = await prisma.taskrecurrence.findFirst({ where: { id, companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) } });
  if (!recurrence) return;
  const { generated } = await processDueRecurrence(recurrence, new Date());
  await audit({ companyId, actorId: user.id, action: "TASK_RECURRENCE_MANUAL_RUN", entityType: "TaskRecurrence", entityId: id, metadata: { generated } });
  revalidatePath("/dashboard/task-recurrences");
  revalidatePath(`/dashboard/task-recurrences/${id}`);
  revalidatePath("/dashboard/tasks");
}
