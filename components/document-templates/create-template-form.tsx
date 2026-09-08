"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDocumentTemplate } from "@/lib/actions/document-templates";
import type { ActionState } from "@/lib/actions/helpers";

const initialState: ActionState = {};

export function CreateTemplateForm({ documentType, placeholder }: { documentType: string; placeholder: string }) {
  const [state, formAction] = useActionState(createDocumentTemplate, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="documentType" value={documentType} />
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-500">New template name</span>
        <Input name="name" placeholder={placeholder} required maxLength={80} />
      </div>
      <Button type="submit" variant="secondary">Create template</Button>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
