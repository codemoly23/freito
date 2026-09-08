import "server-only";
import { generateAIText, type AIGatewayUser } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";

// Generic on purpose -- any report page can build a `metrics` array (current
// vs the immediately preceding period of the same length) and get a
// narrative summary, without this file knowing anything about that report's
// own data shape.
export type ReportInsightMetric = {
  label: string;
  current: number;
  previous: number;
  format?: "money" | "percent" | "count";
};

function formatMetric(value: number, format: ReportInsightMetric["format"]) {
  if (format === "money") return `BDT ${Math.round(value).toLocaleString("en-US")}`;
  if (format === "percent") return `${value.toFixed(1)}%`;
  return value.toLocaleString("en-US");
}

function changeDescription(current: number, previous: number) {
  if (previous === 0) return current === 0 ? "no change" : "new this period";
  const percent = ((current - previous) / Math.abs(previous)) * 100;
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

const REPORT_INSIGHT_PROMPT_INTRO = `You are a freight-forwarding operations analyst. Given metrics for the current reporting period and the immediately preceding period of the same length, write a short 3-4 sentence plain-English summary of what changed and why it matters to the business. Mention only real, meaningful changes -- do not comment on a metric that barely moved. Do not just list every number back; focus on the overall story. Only describe a likely cause if it's directly visible from the other listed metrics -- otherwise just describe the change itself without guessing a reason.`;

export async function generateReportInsight(
  user: AIGatewayUser,
  params: { reportName: string; periodLabel: string; metrics: ReportInsightMetric[] },
) {
  const lines = params.metrics.map(
    (metric) =>
      `${metric.label}: ${formatMetric(metric.current, metric.format)} (previous period: ${formatMetric(metric.previous, metric.format)}, change: ${changeDescription(metric.current, metric.previous)})`,
  );
  const prompt = `${REPORT_INSIGHT_PROMPT_INTRO}\n\nReport: ${params.reportName}\nCurrent period: ${params.periodLabel}\n\n${lines.join("\n")}`;

  return generateAIText(user, aiFeatures.reportInsights, prompt, { entityType: "report", entityId: params.reportName });
}
