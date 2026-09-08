import "server-only";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { getShipmentHealthScore } from "@/lib/ai/health-score";
import { generateAIText, type AIGatewayFailureReason, type AIGatewayUser } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";

// Shared, non-LLM context builder -- used by both the Summary card and the
// Assistant chat (Phase 5's "Shipment Copilot" pairing). Everything the model
// sees is pre-fetched and scoped to this one shipment; no raw DB access is
// ever handed to the LLM.
export type ShipmentAiContext = {
  jobNo: string;
  customerName: string;
  currentStatus: string | null;
  eta: string | null;
  healthScore: number | null;
  healthFactors: string[];
  overdueWorkflowSteps: string[];
  rejectedDocuments: string[];
  pendingTasks: string[];
};

export type ShipmentContextFailureReason = "NOT_FOUND" | "FORBIDDEN";

export type ShipmentContextResult =
  | { ok: true; data: ShipmentAiContext }
  | { ok: false; reason: ShipmentContextFailureReason; message: string };

export async function getShipmentAiContext(
  user: AIGatewayUser,
  shipmentJobId: string,
): Promise<ShipmentContextResult> {
  if (!user.companyId) {
    return { ok: false, reason: "FORBIDDEN", message: "AI features require a company-scoped account." };
  }

  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId: user.companyId,
    permissions: user.permissions ?? [],
  });

  const now = new Date();
  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId: user.companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    select: {
      jobNo: true,
      currentStatus: true,
      eta: true,
      customer: { select: { name: true } },
      shipmentworkflowstep: {
        where: { deletedAt: null, dueDate: { lt: now }, status: { notIn: ["COMPLETED", "CANCELLED"] } },
        select: { title: true, dueDate: true },
      },
      shipmentdocument: {
        where: { deletedAt: null, status: "REJECTED" },
        select: { documentName: true },
      },
      task: {
        where: { deletedAt: null, status: { notIn: ["DONE", "CANCELLED"] } },
        select: { title: true, dueDate: true },
      },
    },
  });
  if (!shipment) {
    return { ok: false, reason: "NOT_FOUND", message: "Shipment not found." };
  }

  const health = await getShipmentHealthScore(shipmentJobId, user.companyId);

  return {
    ok: true,
    data: {
      jobNo: shipment.jobNo,
      customerName: shipment.customer.name,
      currentStatus: shipment.currentStatus,
      eta: shipment.eta ? shipment.eta.toISOString().slice(0, 10) : null,
      healthScore: health?.score ?? null,
      healthFactors: health?.factors.map((f) => f.label) ?? [],
      overdueWorkflowSteps: shipment.shipmentworkflowstep.map(
        (s) => `${s.title}${s.dueDate ? ` (due ${s.dueDate.toISOString().slice(0, 10)})` : ""}`,
      ),
      rejectedDocuments: shipment.shipmentdocument.map((d) => d.documentName),
      pendingTasks: shipment.task.map(
        (t) => `${t.title}${t.dueDate ? ` (due ${t.dueDate.toISOString().slice(0, 10)})` : ""}`,
      ),
    },
  };
}

export function shipmentContextToPromptBlock(ctx: ShipmentAiContext): string {
  return [
    `Job No: ${ctx.jobNo}`,
    `Customer: ${ctx.customerName}`,
    `Current status: ${ctx.currentStatus ?? "Unknown"}`,
    `ETA: ${ctx.eta ?? "Not set"}`,
    `Health score: ${ctx.healthScore ?? "N/A"}/100${ctx.healthFactors.length ? ` (${ctx.healthFactors.join("; ")})` : ""}`,
    `Overdue workflow steps: ${ctx.overdueWorkflowSteps.length ? ctx.overdueWorkflowSteps.join("; ") : "None"}`,
    `Rejected documents: ${ctx.rejectedDocuments.length ? ctx.rejectedDocuments.join(", ") : "None"}`,
    `Pending tasks: ${ctx.pendingTasks.length ? ctx.pendingTasks.join("; ") : "None"}`,
  ].join("\n");
}

export type ShipmentSummaryResult =
  | { ok: true; data: string }
  | { ok: false; reason: ShipmentContextFailureReason | AIGatewayFailureReason; message: string };

const SUMMARY_PROMPT_INSTRUCTIONS =
  "Summarize the current state of this freight shipment in 3-5 short sentences for an operations user. Be concrete and call out any risk (delays, rejected documents, overdue tasks) if present; otherwise say it looks on track. Only use the facts given below -- do not invent anything.";

// Always generated fresh, never cached -- the "Regenerate" button on the
// Summary card calls this again rather than reading a stored value.
export async function getShipmentSummary(user: AIGatewayUser, shipmentJobId: string): Promise<ShipmentSummaryResult> {
  const context = await getShipmentAiContext(user, shipmentJobId);
  if (!context.ok) return context;

  const prompt = `${SUMMARY_PROMPT_INSTRUCTIONS}\n\n${shipmentContextToPromptBlock(context.data)}`;
  return generateAIText(user, aiFeatures.shipmentSummary, prompt, {
    entityType: "shipmentjob",
    entityId: shipmentJobId,
  });
}
