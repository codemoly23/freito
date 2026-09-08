"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const initialState: ActionState = {};

function FormAlert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div
      className={
        state.ok
          ? "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      }
    >
      {state.message}
    </div>
  );
}

export function ImportUploadForm({ action }: { action: FormAction }) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <FormAlert state={state} />
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">What are you importing?</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="entityType" value="CUSTOMER" defaultChecked required />
            Customers
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="entityType" value="VENDOR" required />
            Vendors
          </label>
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="file" className="text-sm font-medium text-slate-700">CSV file</label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <Button type="submit">Upload and continue</Button>
    </form>
  );
}

export function ImportMappingForm({
  action,
  importJobId,
  headers,
  fields,
  defaultMapping = {},
  defaultDuplicatePolicy = "REJECT",
}: {
  action: FormAction;
  importJobId: string;
  headers: string[];
  fields: { field: string; label: string; required: boolean }[];
  defaultMapping?: Record<string, string>;
  defaultDuplicatePolicy?: "REJECT" | "SKIP" | "UPDATE";
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="importJobId" value={importJobId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.field} className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              {f.label}
              {f.required ? <span className="text-red-600"> *</span> : null}
            </label>
            <select
              name={`map_${f.field}`}
              defaultValue={defaultMapping[f.field] ?? ""}
              required={f.required}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">-- Not mapped --</option>
              {headers.map((header) => (
                <option key={header} value={header}>{header}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">If a row matches an existing record</label>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="duplicatePolicy" value="REJECT" defaultChecked={defaultDuplicatePolicy === "REJECT"} />
            Reject (skip and report)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="duplicatePolicy" value="SKIP" defaultChecked={defaultDuplicatePolicy === "SKIP"} />
            Skip silently
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="duplicatePolicy" value="UPDATE" defaultChecked={defaultDuplicatePolicy === "UPDATE"} />
            Update existing record
          </label>
        </div>
      </div>
      <Button type="submit">Validate and preview</Button>
    </form>
  );
}

export function ImportCommitForm({ action, importJobId }: { action: FormAction; importJobId: string }) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <FormAlert state={state} />
      <input type="hidden" name="importJobId" value={importJobId} />
      <Button type="submit">Commit import</Button>
    </form>
  );
}
