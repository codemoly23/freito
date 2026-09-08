"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

const initialState: ActionState = {};

function FormAlert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "text-sm font-medium text-emerald-700" : "text-sm font-medium text-red-700"}>
      {state.message}
    </p>
  );
}

export function FinanceCloseExceptionsForm({
  action,
  shipmentJobId,
  allowUnpaidReceivableClose,
  vendorPayablesNotApplicable,
  notes,
  disabled,
}: {
  action: FormAction;
  shipmentJobId: string;
  allowUnpaidReceivableClose: boolean;
  vendorPayablesNotApplicable: boolean;
  notes?: string | null;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="allowUnpaidReceivableClose"
          defaultChecked={allowUnpaidReceivableClose}
          disabled={disabled}
          className="mt-1"
        />
        <span>Allow finance close with unpaid customer receivable</span>
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="vendorPayablesNotApplicable"
          defaultChecked={vendorPayablesNotApplicable}
          disabled={disabled}
          className="mt-1"
        />
        <span>Vendor payables are not applicable for this job</span>
      </label>
      <label className="block space-y-1 text-sm text-slate-700">
        <span>Finance close notes</span>
        <textarea
          name="notes"
          defaultValue={notes ?? ""}
          disabled={disabled}
          rows={3}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm disabled:bg-slate-100"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={disabled || pending} variant="outline">
          Update finance close exceptions
        </Button>
        <FormAlert state={state} />
      </div>
    </form>
  );
}

export function FinanceCloseActionForm({
  action,
  shipmentJobId,
  label,
  notes,
  disabled,
}: {
  action: FormAction;
  shipmentJobId: string;
  label: string;
  notes?: string | null;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="notes" value={notes ?? ""} />
      <Button type="submit" disabled={disabled || pending}>
        {label}
      </Button>
      <FormAlert state={state} />
    </form>
  );
}
