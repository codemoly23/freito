import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getDelayRiskShipments } from "@/lib/ai/delay-risk";
import { getLowMarginShipments } from "@/lib/ai/profit-analysis";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";

// Aggregates the other Phase 2 signals (delay risk, low-margin/loss shipments)
// plus rejected documents into one "needs attention" feed. Document Checker
// (a later phase) will add its own signal here once it exists -- tracked as a
// deferred follow-up in AI_IMPLEMENTATION_PLAN.md.
export type ExceptionSeverity = "MEDIUM" | "HIGH";

export type ExceptionItem = {
  type: "DELAY" | "LOW_MARGIN" | "REJECTED_DOCUMENT";
  shipmentId: string;
  jobNo: string;
  title: string;
  severity: ExceptionSeverity;
  href: string;
};

const MAX_ITEMS = 30;

export async function getExceptionRadarFeed(): Promise<{ enabled: boolean; items: ExceptionItem[] }> {
  const { user, companyId, branchWhere } = await requireReportsPage();
  if (!hasPermission(user, "ai:use")) return { enabled: false, items: [] };

  const [delay, rejectedDocs, lowMargin] = await Promise.all([
    getDelayRiskShipments(),
    prisma.shipmentdocument.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: "REJECTED",
        ...branchWhere,
        shipmentjob: { deletedAt: null, closedAt: null },
      },
      select: {
        documentName: true,
        shipmentJobId: true,
        shipmentjob: { select: { jobNo: true } },
      },
      take: 200,
    }),
    hasPermission(user, "reports:financial") ? getLowMarginShipments() : Promise.resolve({ enabled: false, items: [] as Awaited<ReturnType<typeof getLowMarginShipments>>["items"] }),
  ]);

  const items: ExceptionItem[] = [];

  for (const item of delay.items) {
    items.push({ type: "DELAY", shipmentId: item.shipmentId, jobNo: item.jobNo, title: item.reason, severity: item.level, href: item.href });
  }

  for (const item of lowMargin.items) {
    items.push({
      type: "LOW_MARGIN",
      shipmentId: item.shipmentId,
      jobNo: item.jobNo,
      title: item.reason,
      severity: item.profit < 0 ? "HIGH" : "MEDIUM",
      href: item.href,
    });
  }

  const seenRejected = new Set<string>();
  for (const doc of rejectedDocs) {
    if (seenRejected.has(doc.shipmentJobId)) continue; // one line per shipment keeps the feed readable
    seenRejected.add(doc.shipmentJobId);
    items.push({
      type: "REJECTED_DOCUMENT",
      shipmentId: doc.shipmentJobId,
      jobNo: doc.shipmentjob.jobNo,
      title: `Document rejected: ${doc.documentName}`,
      severity: "MEDIUM",
      href: `/dashboard/shipments/${doc.shipmentJobId}`,
    });
  }

  items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "HIGH" ? -1 : 1));
  return { enabled: true, items: items.slice(0, MAX_ITEMS) };
}
