"use client";

import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, UploadCloud, FileUp, CheckCircle } from "lucide-react";

type ChecklistItem = {
  id: string;
  name: string;
  isRequired: boolean;
};

type StoredDocument = {
  id: string;
  checklistItemId: string | null;
  documentName: string;
  status: string;
};

export function PortalBulkDocumentUploadForm({
  action,
  shipmentJobId,
  checklist,
  documents,
  companySlug,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  shipmentJobId: string;
  checklist: ChecklistItem[];
  documents: StoredDocument[];
  companySlug: string;
}) {
  const [state, formAction, isPending] = useActionState(action, {});
  const [selectedCount, setSelectedCount] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const form = e.target.form;
    if (!form) return;
    
    let count = 0;
    checklist.forEach((item) => {
      const input = form.querySelector(`input[name="file_${item.id}"]`) as HTMLInputElement | null;
      if (input && input.files && input.files.length > 0) {
        count++;
      }
    });
    setSelectedCount(count);
  };

  return (
    <form action={formAction} className="space-y-6">
      <input name="shipmentJobId" type="hidden" value={shipmentJobId} />
      
      <div className="space-y-4">
        {checklist.map((item) => {
          const document = documents.find((candidate) => candidate.checklistItemId === item.id);
          const status = document?.status ?? "MISSING";
          
          return (
            <div 
              key={item.id} 
              className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 transition-all hover:shadow-sm md:grid-cols-[1fr_auto_280px] items-center"
            >
              <div>
                <p className="font-semibold text-slate-800">{item.name}</p>
                <div className="flex gap-2 items-center mt-1">
                  <span className="text-xs text-slate-500">
                    {item.isRequired ? "Required" : "Optional"}
                  </span>
                  {document && document.status !== "PENDING" && (
                    <>
                      <span className="text-slate-300">•</span>
                      <a 
                        className="text-xs font-medium text-cyan-600 hover:text-cyan-800 hover:underline inline-flex items-center gap-1" 
                        href={`/api/portal/${companySlug}/documents/${document.id}/download`}
                      >
                        <FileUp className="h-3 w-3" />
                        Download uploaded file
                      </a>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center">
                <Badge 
                  variant={status === "VERIFIED" ? "success" : status === "REJECTED" ? "danger" : "secondary"}
                  className="font-medium px-2.5 py-0.5"
                >
                  {status}
                </Badge>
              </div>
              
              <div>
                {status !== "VERIFIED" ? (
                  <div className="space-y-1">
                    <Input 
                      aria-label={`Upload file for ${item.name}`} 
                      name={`file_${item.id}`} 
                      type="file" 
                      onChange={handleFileChange}
                      className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                    <p className="text-[10px] text-slate-400">
                      Formats: PDF, PNG, JPG (Max 10MB)
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-md p-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Verified documents cannot be replaced.</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-left w-full sm:w-auto">
          <p className="text-sm font-semibold text-slate-800">
            Bulk Document Upload
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedCount === 0 
              ? "Select files for missing or rejected documents to upload." 
              : `${selectedCount} file(s) selected for upload.`}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-end">
          {state.message && (
            <p className={`text-xs font-medium ${state.ok ? "text-emerald-700" : "text-red-600"}`}>
              {state.message}
            </p>
          )}
          
          <Button 
            type="submit" 
            disabled={isPending}
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white shrink-0"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadCloud className="mr-2 h-4 w-4" />
                Upload Selected{selectedCount > 0 ? ` (${selectedCount})` : ""}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
