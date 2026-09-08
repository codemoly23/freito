"use client";

import { useActionState } from "react";
import { CheckCircle2, Upload, XCircle } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const initialState: ActionState = {};

function FormAlert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>
      {state.message}
    </p>
  );
}

export function DocumentUploadForm({
  action,
  shipmentJobId,
  checklistItemId,
  label = "Upload",
}: {
  action: FormAction;
  shipmentJobId: string;
  checklistItemId: string;
  label?: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="checklistItemId" value={checklistItemId} />
      <div className="space-y-2"><Label htmlFor={`documentFile-${checklistItemId}`}>Document file</Label><Input id={`documentFile-${checklistItemId}`} name="file" type="file" className="max-w-xs" /></div>
      <div className="space-y-2"><Label htmlFor={`documentRemarks-${checklistItemId}`}>Upload remarks</Label><Input id={`documentRemarks-${checklistItemId}`} name="remarks" className="max-w-xs" /></div>
      <div>
        <Button type="submit" size="sm" variant="secondary">
          <Upload className="h-4 w-4" />
          {label}
        </Button>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

export function DocumentRejectForm({
  action,
  shipmentJobId,
  documentId,
}: {
  action: FormAction;
  shipmentJobId: string;
  documentId: string;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="documentId" value={documentId} />
      <div className="space-y-2"><Label htmlFor={`rejectRemarks-${documentId}`}>Rejection remarks</Label><Input id={`rejectRemarks-${documentId}`} name="remarks" className="max-w-xs" /></div>
      <div>
        <Button type="submit" size="sm" variant="outline">
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>
      <FormAlert state={state} />
    </form>
  );
}

export function VerifyButton({
  shipmentJobId,
  documentId,
}: {
  shipmentJobId: string;
  documentId: string;
}) {
  return (
    <>
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="documentId" value={documentId} />
      <Button type="submit" size="sm" variant="secondary">
        <CheckCircle2 className="h-4 w-4" />
        Verify
      </Button>
    </>
  );
}
