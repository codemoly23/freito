import "server-only";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/reports/filters";

// Deterministic, explainable scoring -- no LLM call, so it works even when no
// AI provider is configured. Only gated by the "ai:use" permission (this is
// an AI-branded feature), never by AI_ENABLED/company AI settings, since it
// costs nothing to compute. Phase 5 may add an optional one-line LLM
// narration on top of this without touching the scoring itself.
export type HealthScoreFactor = {
  label: string;
  impact: number; // negative = deduction
};

export type HealthScoreResult = {
  score: number; // 0-100
  factors: HealthScoreFactor[];
};

const now = () => new Date();

export async function getShipmentHealthScore(shipmentJobId: string, companyId: string): Promise<HealthScoreResult | null> {
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId, deletedAt: null },
    select: {
      eta: true,
      closedAt: true,
      deliveredAt: true,
      blockedStageCount: true,
      grossProfit: true,
      profitMarginPercent: true,
      financeCloseStatus: true,
      finalGrossProfit: true,
      finalProfitMarginPercent: true,
      shipmentworkflowstep: {
        where: { deletedAt: null, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        select: { dueDate: true },
      },
      task: {
        where: { deletedAt: null, status: { notIn: ["DONE", "CANCELLED"] } },
        select: { dueDate: true },
      },
    },
  });
  if (!shipment) return null;

  const today = now();
  const factors: HealthScoreFactor[] = [];
  let score = 100;

  const etaOverdue = shipment.eta && shipment.eta < today && !shipment.closedAt && !shipment.deliveredAt;
  if (etaOverdue) {
    const deduction = -25;
    score += deduction;
    factors.push({ label: "ETA has passed and the shipment is not yet delivered or closed", impact: deduction });
  }

  const overdueSteps = shipment.shipmentworkflowstep.filter((step) => step.dueDate && step.dueDate < today).length;
  if (overdueSteps > 0) {
    const deduction = -Math.min(20, overdueSteps * 5);
    score += deduction;
    factors.push({ label: `${overdueSteps} overdue workflow step(s)`, impact: deduction });
  }

  if (shipment.blockedStageCount > 0) {
    const deduction = -15;
    score += deduction;
    factors.push({ label: `${shipment.blockedStageCount} blocked workflow stage(s)`, impact: deduction });
  }

  const overdueTasks = shipment.task.filter((task) => task.dueDate && task.dueDate < today).length;
  if (overdueTasks > 0) {
    const deduction = -Math.min(15, overdueTasks * 5);
    score += deduction;
    factors.push({ label: `${overdueTasks} overdue task(s)`, impact: deduction });
  }

  const locked = shipment.financeCloseStatus === "LOCKED";
  const profit = decimalToNumber(locked ? shipment.finalGrossProfit : shipment.grossProfit);
  const margin = decimalToNumber(locked ? shipment.finalProfitMarginPercent : shipment.profitMarginPercent);
  if (profit < 0) {
    const deduction = -10;
    score += deduction;
    factors.push({ label: "Shipment is currently loss-making", impact: deduction });
  } else if (margin > 0 && margin < 10) {
    const deduction = -5;
    score += deduction;
    factors.push({ label: "Profit margin is below 10%", impact: deduction });
  }

  return { score: Math.max(0, Math.min(100, score)), factors };
}
