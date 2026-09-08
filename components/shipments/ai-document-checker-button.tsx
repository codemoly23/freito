"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkShipmentDocumentAction } from "@/lib/actions/ai-document-checker";
import type { DocumentCheckerIssue } from "@/lib/ai/document-checker";

export function AIDocumentCheckerButton({ documentId, documentName }: { documentId: string; documentName: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChecking, startChecking] = useTransition();
  const [issues, setIssues] = useState<DocumentCheckerIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = () => {
    setIsOpen(true);
    setIssues(null);
    setError(null);
    startChecking(async () => {
      const result = await checkShipmentDocumentAction(documentId);
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
        onClick={handleCheck}
        className="h-7 text-[10px] gap-1 border-purple-200 hover:border-purple-300 text-purple-700 bg-purple-50/30 hover:bg-purple-50 dark:border-purple-800 dark:hover:border-purple-700 dark:text-purple-400 dark:bg-purple-950/40 dark:hover:bg-purple-900/40"
      >
        <Sparkles className="h-3 w-3" />
        AI Check
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">AI Document Check</h3>
                <p className="text-[10px] text-slate-500">{documentName}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="h-8 w-8 text-slate-400 hover:text-slate-950">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {isChecking ? (
                <div className="flex flex-col items-center justify-center space-y-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                  <p className="text-xs font-semibold text-slate-700">Checking document against the shipment record...</p>
                </div>
              ) : error ? (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              ) : issues && issues.length === 0 ? (
                <div className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>No inconsistencies found. This document matches the shipment record.</span>
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
                      {(issue.shipmentRecordValue || issue.documentValue) ? (
                        <p className="mt-1 text-[10px] text-slate-500">
                          Record: {issue.shipmentRecordValue ?? "-"} · Document: {issue.documentValue ?? "-"}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <p className="mt-3 border-t border-slate-100 pt-3 text-[9px] text-slate-500">
              Informational only -- this does not verify, reject, or change the document. Review and act on it yourself.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
