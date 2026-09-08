import "server-only";
import { getExceptionRadarFeed, type ExceptionItem } from "@/lib/ai/exception-radar";

// Deterministic, template-based mapping from Phase 2's Exception Radar feed --
// no LLM call, same reasoning as lib/ai/health-score.ts: a wrong AI-worded
// task title is worse than a clear template for something that becomes a
// real actionable record, and this way it works even with AI disabled
// (Exception Radar's own gate -- ai:use -- still applies underneath).
export type TaskSuggestion = {
  key: string;
  shipmentId: string;
  jobNo: string;
  title: string;
  description: string;
  priority: "HIGH" | "MEDIUM";
  dueDate: string; // YYYY-MM-DD, computed here (data layer) rather than in the UI component's render
};

const MAX_SUGGESTIONS = 10;

function suggestionFor(item: ExceptionItem, now: number): TaskSuggestion {
  const priority: TaskSuggestion["priority"] = item.severity === "HIGH" ? "HIGH" : "MEDIUM";
  const dueInDays = item.severity === "HIGH" ? 1 : 3;
  const dueDate = new Date(now + dueInDays * 86_400_000).toISOString().slice(0, 10);
  const base = { key: `${item.type}-${item.shipmentId}`, shipmentId: item.shipmentId, jobNo: item.jobNo, priority, dueDate };

  if (item.type === "DELAY") {
    return { ...base, title: `Follow up on delayed shipment ${item.jobNo}`, description: item.title };
  }
  if (item.type === "LOW_MARGIN") {
    return { ...base, title: `Review costing for ${item.jobNo}`, description: item.title };
  }
  return { ...base, title: `Resolve rejected document for ${item.jobNo}`, description: item.title };
}

export async function getSuggestedTasks(): Promise<{ enabled: boolean; suggestions: TaskSuggestion[] }> {
  const radar = await getExceptionRadarFeed();
  if (!radar.enabled) return { enabled: false, suggestions: [] };
  const now = Date.now();
  return { enabled: true, suggestions: radar.items.slice(0, MAX_SUGGESTIONS).map((item) => suggestionFor(item, now)) };
}
