"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateShipmentSummary } from "@/lib/actions/ai-shipment-copilot";

export function AiShipmentSummaryCard({ shipmentId }: { shipmentId: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateShipmentSummary(shipmentId);
      if (!result.ok) {
        setError(result.message);
        setSummary(null);
        return;
      }
      setSummary(result.text);
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-purple-600" />
              AI Shipment Summary
            </CardTitle>
            <CardDescription>A fresh, plain-language summary of this shipment&apos;s current state.</CardDescription>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleGenerate} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...
              </>
            ) : summary ? (
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
        ) : summary ? (
          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{summary}</p>
        ) : (
          <p className="text-sm text-slate-500">Click &quot;Generate&quot; to have AI summarize this shipment.</p>
        )}
      </CardContent>
    </Card>
  );
}
