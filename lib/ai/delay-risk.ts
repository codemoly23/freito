import "server-only";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";

// Deterministic detection, same signal as lib/reports/dashboard-summary.ts's
// `delayedJobs` count (ETA passed while not delivered/closed, or an overdue
// workflow step) -- this just returns the identifiable list with a severity
// instead of only a count. Gated by "ai:use" (AI-branded feature), not by the
// AI provider toggle, since no LLM call is made.
export type DelayRiskLevel = "MEDIUM" | "HIGH";

export type DelayRiskItem = {
  shipmentId: string;
  jobNo: string;
  customerName: string;
  level: DelayRiskLevel;
  reason: string;
  href: string;
};

const MAX_ITEMS = 15;

export async function getDelayRiskShipments(): Promise<{ enabled: boolean; items: DelayRiskItem[] }> {
  const { user, companyId, branchWhere } = await requireReportsPage("operations");
  if (!hasPermission(user, "ai:use")) return { enabled: false, items: [] };

  const now = new Date();
  const shipments = await prisma.shipmentjob.findMany({
    where: { companyId, deletedAt: null, closedAt: null, deliveredAt: null, ...branchWhere },
    select: {
      id: true,
      jobNo: true,
      eta: true,
      customer: { select: { name: true } },
      shipmentworkflowstep: {
        where: { deletedAt: null, dueDate: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        select: { id: true },
      },
    },
    take: 500,
  });

  const items: DelayRiskItem[] = [];
  for (const shipment of shipments) {
    const etaOverdueDays = shipment.eta && shipment.eta < now
      ? Math.floor((now.getTime() - shipment.eta.getTime()) / 86_400_000)
      : 0;
    const overdueStepCount = shipment.shipmentworkflowstep.length;
    if (etaOverdueDays <= 0 && overdueStepCount === 0) continue;

    const level: DelayRiskLevel = etaOverdueDays > 7 || overdueStepCount > 1 ? "HIGH" : "MEDIUM";
    const reasonParts: string[] = [];
    if (etaOverdueDays > 0) reasonParts.push(`ETA passed ${etaOverdueDays} day(s) ago`);
    if (overdueStepCount > 0) reasonParts.push(`${overdueStepCount} overdue workflow step(s)`);

    items.push({
      shipmentId: shipment.id,
      jobNo: shipment.jobNo,
      customerName: shipment.customer.name,
      level,
      reason: reasonParts.join(" and "),
      href: `/dashboard/shipments/${shipment.id}`,
    });
  }

  items.sort((a, b) => (a.level === b.level ? 0 : a.level === "HIGH" ? -1 : 1));
  return { enabled: true, items: items.slice(0, MAX_ITEMS) };
}
