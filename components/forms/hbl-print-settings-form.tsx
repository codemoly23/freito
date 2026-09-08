"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HblPrintSettingsForm({
  action,
  initialValues,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialValues: {
    hblOriginalsLimit: number;
    hblOfficeLimit: number;
    hblAccountsLimit: number;
    hblOperationsLimit: number;
    hblCustomerLimit: number;
    hblArchiveLimit: number;
    hblPrintWatermarkEnabled: boolean;
  };
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="hblOriginalsLimit">Original Copies (Negotiable)</Label>
          <Input
            id="hblOriginalsLimit"
            name="hblOriginalsLimit"
            type="number"
            min="0"
            defaultValue={initialValues.hblOriginalsLimit}
            required
          />
          <p className="text-xs text-slate-500">Legal originals watermarked with ORIGINAL prefix.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hblOfficeLimit">Office Copies</Label>
          <Input
            id="hblOfficeLimit"
            name="hblOfficeLimit"
            type="number"
            min="0"
            defaultValue={initialValues.hblOfficeLimit}
            required
          />
          <p className="text-xs text-slate-500">Watermarked with OFFICE COPY.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hblAccountsLimit">Accounts Copies</Label>
          <Input
            id="hblAccountsLimit"
            name="hblAccountsLimit"
            type="number"
            min="0"
            defaultValue={initialValues.hblAccountsLimit}
            required
          />
          <p className="text-xs text-slate-500">Watermarked with ACCOUNTS COPY.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hblOperationsLimit">Operations Copies</Label>
          <Input
            id="hblOperationsLimit"
            name="hblOperationsLimit"
            type="number"
            min="0"
            defaultValue={initialValues.hblOperationsLimit}
            required
          />
          <p className="text-xs text-slate-500">Watermarked with OPERATIONS COPY.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hblCustomerLimit">Customer Copies</Label>
          <Input
            id="hblCustomerLimit"
            name="hblCustomerLimit"
            type="number"
            min="0"
            defaultValue={initialValues.hblCustomerLimit}
            required
          />
          <p className="text-xs text-slate-500">Watermarked with CUSTOMER COPY.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hblArchiveLimit">Archive Copies</Label>
          <Input
            id="hblArchiveLimit"
            name="hblArchiveLimit"
            type="number"
            min="0"
            defaultValue={initialValues.hblArchiveLimit}
            required
          />
          <p className="text-xs text-slate-500">Watermarked with ARCHIVE COPY.</p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="hblPrintWatermarkEnabled">Print Background Watermarks</Label>
          <select
            id="hblPrintWatermarkEnabled"
            name="hblPrintWatermarkEnabled"
            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue={initialValues.hblPrintWatermarkEnabled ? "true" : "false"}
            required
          >
            <option value="true">Yes, show copy watermarks in middle of page</option>
            <option value="false">No, do not show background watermarks</option>
          </select>
          <p className="text-xs text-slate-500">Whether printed pages should display diagonal background copy text watermarks.</p>
        </div>
      </div>

      <Button type="submit">Save Print Settings</Button>
      {state.message ? (
        <p className={state.ok ? "text-sm text-emerald-700 font-medium" : "text-sm text-red-600 font-medium"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
