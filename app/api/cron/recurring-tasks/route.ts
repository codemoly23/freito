import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { processDueRecurrence } from "@/lib/recurring-tasks/runner";

const BATCH_SIZE = 50;

function isAuthorized(request: NextRequest) {
  const expected = process.env.RECURRING_TASK_DISPATCH_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("x-dispatch-secret") ?? "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

// Self-hosted cron setup:
//   curl -X POST -H "x-dispatch-secret: $RECURRING_TASK_DISPATCH_SECRET" https://<host>/api/cron/recurring-tasks
// Run on a schedule (e.g. every hour) from the deployment's own crontab or
// scheduler. See README.md for the full self-hosted cron section. Idempotent
// and crash-safe -- see lib/recurring-tasks/runner.ts for how.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const due = await prisma.taskrecurrence.findMany({
    where: { isActive: true, deletedAt: null, nextRunAt: { lte: now } },
    take: BATCH_SIZE,
    orderBy: { nextRunAt: "asc" },
  });

  let processed = 0;
  let generated = 0;
  let failed = 0;

  for (const recurrence of due) {
    try {
      const result = await processDueRecurrence(recurrence, now);
      generated += result.generated;
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ due: due.length, processed, generated, failed });
}
