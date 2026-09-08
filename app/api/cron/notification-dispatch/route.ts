import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { runNotificationDelivery } from "@/lib/notifications/delivery-runner";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 50;
// Exponential backoff by attempt count: 5min, 20min, 1hr, 4hr.
const BACKOFF_MINUTES = [5, 20, 60, 240];

function backoffMs(attempts: number) {
  const minutes = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)];
  return minutes * 60 * 1000;
}

function isAuthorized(request: NextRequest) {
  const expected = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!expected) return false;

  const provided = request.headers.get("x-dispatch-secret") ?? "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

// Self-hosted cron setup:
//   curl -X POST -H "x-dispatch-secret: $NOTIFICATION_DISPATCH_SECRET" https://<host>/api/cron/notification-dispatch
// Run on a schedule (e.g. every 5 minutes) from the deployment's own crontab
// or scheduler. See README.md for the full self-hosted cron section.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const candidates = await prisma.notificationdelivery.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      deletedAt: null,
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
      notificationtemplate: { autoSendApproved: true, isSystem: false },
    },
    take: BATCH_SIZE,
    orderBy: { createdAt: "asc" },
    select: { id: true, companyId: true, status: true, attempts: true },
  });

  let claimed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let raced = 0;

  for (const candidate of candidates) {
    if (!candidate.companyId) continue;

    // Atomic claim: a second concurrent cron invocation racing on the same row
    // will see count === 0 (the row's status already changed) and skip it.
    const claim = await prisma.notificationdelivery.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: { status: "PROCESSING" },
    });
    if (claim.count !== 1) {
      raced += 1;
      continue;
    }
    claimed += 1;
    let candidateFailed = false;

    try {
      const result = await runNotificationDelivery({
        companyId: candidate.companyId,
        deliveryId: candidate.id,
        // Already atomically claimed into PROCESSING above -- runNotificationDelivery's
        // default PENDING/FAILED check would otherwise reject this exact row.
        allowedStatuses: ["PROCESSING"],
      });
      if (result.ok) sent += 1;
      else if (result.skipped) skipped += 1;
      else {
        failed += 1;
        candidateFailed = true;
      }
    } catch {
      failed += 1;
      candidateFailed = true;
      await prisma.notificationdelivery.update({
        where: { id: candidate.id },
        data: { status: "FAILED", failedAt: new Date() },
      });
    }

    if (candidateFailed) {
      const updated = await prisma.notificationdelivery.findUnique({
        where: { id: candidate.id },
        select: { status: true, attempts: true },
      });
      if (updated?.status === "FAILED") {
        await prisma.notificationdelivery.update({
          where: { id: candidate.id },
          data: { nextAttemptAt: new Date(Date.now() + backoffMs(updated.attempts)) },
        });
      }
    }
  }

  return NextResponse.json({ candidates: candidates.length, claimed, sent, skipped, failed, raced });
}
