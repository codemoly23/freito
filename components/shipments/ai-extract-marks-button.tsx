"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2, Save, X, Bot, AlertTriangle } from "lucide-react";
import { saveShipmentMarksAndNumbers } from "@/lib/actions/shipments";
import { extractShipmentDocumentFields } from "@/lib/actions/ai-document-reader";
import type { ActionState } from "@/lib/actions/helpers";

type AIExtractMarksButtonProps = {
  shipmentId: string;
  documentId: string;
  documentName: string;
};

const initialState: ActionState = {};

export function AIExtractMarksButton({ shipmentId, documentId, documentName }: AIExtractMarksButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExtracting, startExtraction] = useTransition();
  const [extractedText, setExtractedText] = useState("");
  const [lowConfidenceLabels, setLowConfidenceLabels] = useState<string[]>([]);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [hasResult, setHasResult] = useState(false);
  const [state, formAction, pending] = useActionState(saveShipmentMarksAndNumbers, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- close the modal once the save action reports success.
      setIsOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  const handleStartExtraction = () => {
    setIsOpen(true);
    setHasResult(false);
    setExtractError(null);
    setExtractedText("");
    setLowConfidenceLabels([]);
    startExtraction(async () => {
      const result = await extractShipmentDocumentFields(documentId);
      if (!result.ok) {
        setExtractError(result.message);
        return;
      }
      setExtractedText(result.text);
      setLowConfidenceLabels(result.fields.filter((f) => f.confidence === "LOW").map((f) => f.label));
      setHasResult(true);
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleStartExtraction}
        className="h-7 text-[10px] gap-1 border-purple-200 hover:border-purple-300 text-purple-700 bg-purple-50/30 hover:bg-purple-50 dark:border-purple-800 dark:hover:border-purple-700 dark:text-purple-400 dark:bg-purple-950/40 dark:hover:bg-purple-900/40"
      >
        <Sparkles className="h-3 w-3" />
        AI Extract Marks
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-1.5 rounded-lg text-purple-700 dark:bg-purple-950/40 dark:text-purple-400">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">AI Document Reader</h3>
                  <p className="text-[10px] text-slate-500">Processing: {documentName}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                disabled={isExtracting || pending}
                className="h-8 w-8 text-slate-400 hover:text-slate-950"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isExtracting ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <p className="text-xs font-semibold text-slate-700">Reading document...</p>
              </div>
            ) : extractError ? (
              <div className="py-6 space-y-4">
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{extractError}</span>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(false)} className="h-8 text-xs">
                    Close
                  </Button>
                  <Button type="button" size="sm" onClick={handleStartExtraction} className="h-8 text-xs">
                    Try Again
                  </Button>
                </div>
              </div>
            ) : hasResult ? (
              <form action={formAction} className="mt-4 space-y-4">
                <input type="hidden" name="shipmentId" value={shipmentId} />

                {state.message && (
                  <div className={`p-3 rounded text-xs font-medium ${state.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}>
                    {state.message}
                  </div>
                )}

                {lowConfidenceLabels.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Low-confidence read on: {lowConfidenceLabels.join(", ")}. Please double-check before saving.</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="marksAndNumbers" className="text-xs font-semibold text-slate-700">
                    Extracted Marks & Numbers (Editable)
                  </Label>
                  <textarea
                    id="marksAndNumbers"
                    name="marksAndNumbers"
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    rows={6}
                    disabled={pending}
                    className="w-full rounded-md border border-slate-200 bg-white p-2.5 font-mono text-xs leading-normal focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                    placeholder="No fields were extracted from this document."
                  />
                  <p className="text-[9px] text-slate-500 leading-tight">
                    * Make any changes above to correct errors before saving. Saving will auto-fill in generated HBL, HAWB, and other freight documents.
                  </p>
                </div>

                <div className="flex justify-end gap-2 border-t pt-3 border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setIsOpen(false)}
                    className="h-8 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={pending}
                    className="bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs gap-1.5"
                  >
                    {pending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" /> Save & Apply
                      </>
                    )}
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
