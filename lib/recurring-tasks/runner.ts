import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type taskrecurrence } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { computeNextOccurrenceInstant, taskDueDateFor, type RecurrenceRule } from "@/lib/recurring-tasks/schedule";

// Backstop against a runaway loop (e.g. a corrupted rule that never advances
// nextRunAt) -- bounds how many missed occurrences a single cron/manual call
// will backfill for one recurrence in one pass. A recurrence with a larger
// backlog than this simply catches up further on the next call.
const MAX_CATCHUP_PER_RECURRENCE = 30;

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Generates every occurrence a recurrence has missed, up to `now`, then
 * advances its schedule. Safe to call repeatedly/concurrently for the same
 * recurrence:
 *  - Task creation is idempotent via the (recurrenceId, occurrenceDate)
 *    unique constraint -- a retried/overlapping call that already created an
 *    occurrence just no-ops on the P2002 and moves on.
 *  - The nextRunAt advance is a conditional update (`WHERE nextRunAt = <value
 *    just read>`); a losing concurrent caller sees `count !== 1` and stops,
 *    so a recurrence is never double-advanced.
 *  - If the process crashes between creating the task and advancing
 *    nextRunAt, the next call re-attempts the same occurrence (idempotent
 *    create) and then successfully advances -- this is the "missed run"
 *    catch-up path, not a special case.
 */
export async function processDueRecurrence(recurrence: taskrecurrence, now: Date) {
  let generated = 0;
  let currentNextRunAt = recurrence.nextRunAt;

  while (currentNextRunAt <= now && generated < MAX_CATCHUP_PER_RECURRENCE) {
    const occurrenceInstant = currentNextRunAt;
    const rule: RecurrenceRule = {
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      timezone: recurrence.timezone,
      startDate: recurrence.startDate,
      endDate: recurrence.endDate,
    };

    try {
      await prisma.task.create({
        data: {
          id: randomUUID(),
          companyId: recurrence.companyId,
          branchId: recurrence.branchId,
          title: recurrence.title,
          description: recurrence.description,
          status: "TODO",
          priority: recurrence.priority,
          dueDate: taskDueDateFor(occurrenceInstant, recurrence.dueInDays, recurrence.timezone),
          assignedUserId: recurrence.assignedUserId,
          customerId: recurrence.customerId,
          vendorId: recurrence.vendorId,
          shipmentJobId: recurrence.shipmentJobId,
          quotationId: recurrence.quotationId,
          invoiceId: recurrence.invoiceId,
          shipmentRequestId: recurrence.shipmentRequestId,
          createdById: recurrence.createdById,
          recurrenceId: recurrence.id,
          occurrenceDate: occurrenceInstant,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const next = computeNextOccurrenceInstant(rule, occurrenceInstant);
    const claim = await prisma.taskrecurrence.updateMany({
      where: { id: recurrence.id, nextRunAt: currentNextRunAt },
      data: next
        ? { nextRunAt: next, lastRunAt: now, updatedAt: now }
        : { lastRunAt: now, isActive: false, updatedAt: now },
    });
    if (claim.count !== 1) break;

    generated += 1;
    if (!next) break;
    currentNextRunAt = next;
  }

  return { generated };
}
