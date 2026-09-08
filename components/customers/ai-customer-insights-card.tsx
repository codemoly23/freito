"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateCustomerInsights } from "@/lib/actions/ai-customer-insights";

export function AiCustomerInsightsCard({ customerId }: { customerId: string }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateCustomerInsights(customerId);
      if (!result.ok) {
        setError(result.message);
        setInsight(null);
        return;
      }
      setInsight(result.text);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-600" />
              AI Customer Insights
            </CardTitle>
            <CardDescription>Activity trend, payment reliability, and upsell signals for this customer.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
              </>
            ) : insight ? (
              "Regenerate"
            ) : (
              "Generate"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : insight ? (
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{insight}</p>
        ) : (
          <p className="text-sm text-slate-500">Click &quot;Generate&quot; to have AI summarize this customer&apos;s relationship.</p>
        )}
      </CardContent>
    </Card>
  );
}
