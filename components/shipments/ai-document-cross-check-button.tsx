"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { crossCheckShipmentDocumentsAction } from "@/lib/actions/ai-document-checker";
import type { DocumentCrossCheckIssue } from "@/lib/ai/document-cross-check";

export function AIDocumentCrossCheckButton({ shipmentJobId, documentCount }: { shipmentJobId: string; documentCount: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, startChecking] = useTransition();
  const [issues, setIssues] = useState<DocumentCrossCheckIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const enabled = documentCount >= 2;

  const handleCheck = () => {
    setIsOpen(true);
    setIssues(null);
    setError(null);
    startChecking(async () => {
      const result = await crossCheckShipmentDocumentsAction(shipmentJobId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setIssues(result.issues);
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!enabled}
        onClick={handleCheck}
        title={enabled ? undefined : "Upload at least two documents to cross-check them"}
        className="gap-1 border-purple-200 text-purple-700 hover:border-purple-300 hover:bg-purple-50 disabled:opacity-50 dark:border-purple-800 dark:text-purple-400 dark:hover:border-purple-700 dark:hover:bg-purple-900/40"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Cross-check documents
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">AI Document Cross-Check</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-slate-400 hover:text-slate-950">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {isChecking ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  <p className="text-xs font-semibold text-slate-700">Reading and comparing documents...</p>
                </div>
              ) : error ? (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              ) : issues && issues.length === 0 ? (
                <div className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>No conflicts found across the compared documents.</span>
                </div>
              ) : issues ? (
                <ul className="space-y-2">
                  {issues.map((issue, index) => (
                    <li key={index} className="rounded-md border border-slate-100 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{issue.field}</span>
                        <Badge variant={issue.severity === "HIGH" ? "danger" : issue.severity === "MEDIUM" ? "warning" : "secondary"}>
                          {issue.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-slate-600">{issue.issue}</p>
                      <ul className="mt-1.5 space-y-0.5">
                        {issue.valuesByDocument.map((entry, entryIndex) => (
                          <li key={entryIndex} className="text-[10px] text-slate-500">
                            {entry.documentLabel}: {entry.value ?? "-"}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <p className="mt-3 border-t border-slate-100 pt-3 text-[9px] text-slate-500">
              Informational only -- this does not verify, reject, or change any document. Review and act on it yourself.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
