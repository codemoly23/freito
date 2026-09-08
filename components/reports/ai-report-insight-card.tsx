import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { generateReportInsight, type ReportInsightMetric } from "@/lib/ai/report-insights";

export async function AIReportInsightCard({
  reportName,
  periodLabel,
  metrics,
}: {
  reportName: string;
  periodLabel: string;
  metrics: ReportInsightMetric[];
}) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY" || !user.companyId) return null;

  const result = await generateReportInsight(
    { id: user.id, companyId: user.companyId, permissions: user.permissions },
    { reportName, periodLabel, metrics },
  );
  if (!result.ok) return null; // AI off/misconfigured/quota -- this is a bonus panel, hide silently rather than showing an error next to a working report

  return (
    <Card className="border-purple-100 bg-purple-50/30 dark:border-purple-900 dark:bg-purple-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-purple-600" />
          AI Insight
        </CardTitle>
        <CardDescription>Generated from this period&apos;s numbers vs. the previous period. Verify against the tables below before acting on it.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-sm text-slate-700">{result.data}</p>
      </CardContent>
    </Card>
  );
}
