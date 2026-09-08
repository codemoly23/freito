"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PortalDocumentUploadForm({
  action,
  shipmentJobId,
  checklistItemId,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  shipmentJobId: string;
  checklistItemId: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className="grid gap-2">
    <input name="shipmentJobId" type="hidden" value={shipmentJobId} />
    <input name="checklistItemId" type="hidden" value={checklistItemId} />
    <Input aria-label="Portal document file" name="file" type="file" />
    <Button size="sm" type="submit" variant="outline">Upload document</Button>
    {state.message ? <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>{state.message}</p> : null}
  </form>;
}
