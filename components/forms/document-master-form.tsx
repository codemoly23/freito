"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface DocumentMasterInput {
  id?: string;
  name: string;
  code: string;
  owner: string;
  docCategory: string;
  media: string;
  transportMode: string;
  isOptional: boolean;
  isRequired: boolean;
  countryRestriction?: string | null;
  incotermRestriction?: string | null;
  lcRequired: boolean;
  ttRequired: boolean;
  hazardousCargo: boolean;
  perishableCargo: boolean;
  temperatureControlled: boolean;
  containerRequired: boolean;
  workflowStage?: string | null;
  mandatoryBeforeJobClose: boolean;
  mandatoryBeforeInvoice: boolean;
  mandatoryBeforeDeliveryOrder: boolean;
  mandatoryBeforeFinanceClose: boolean;
  description?: string | null;
  helpText?: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function DocumentMasterForm({
  action,
  initialData,
  onCancel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initialData?: DocumentMasterInput;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {initialData?.id && <input type="hidden" name="id" value={initialData.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="name" className="text-sm font-semibold">Document Name *</Label>
          <Input id="name" name="name" required defaultValue={initialData?.name} placeholder="e.g. Bill of Lading" />
          {state.errors?.name && <p className="text-xs text-red-500">{state.errors.name[0]}</p>}
        </div>

        <div className="space-y-1">
          <Label htmlFor="code" className="text-sm font-semibold">Document Code (unique slug) *</Label>
          <Input id="code" name="code" required defaultValue={initialData?.code} placeholder="e.g. bill_of_lading" />
          {state.errors?.code && <p className="text-xs text-red-500">{state.errors.code[0]}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="owner" className="text-sm font-semibold">Owner *</Label>
          <select id="owner" name="owner" className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm" defaultValue={initialData?.owner || "FORWARDER"}>
            <option value="CLIENT">Client</option>
            <option value="FORWARDER">Freight Forwarder</option>
            <option value="CARRIER">Carrier</option>
            <option value="CUSTOMS">Customs</option>
            <option value="BANK">Bank</option>
            <option value="GOVERNMENT">Government</option>
            <option value="INTERNAL">Internal</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="docCategory" className="text-sm font-semibold">Category *</Label>
          <select id="docCategory" name="docCategory" className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm" defaultValue={initialData?.docCategory || "Shipping"}>
            <option value="Commercial">Commercial</option>
            <option value="Shipping">Shipping</option>
            <option value="Customs">Customs</option>
            <option value="Compliance">Compliance</option>
            <option value="Financial">Financial</option>
            <option value="Insurance">Insurance</option>
            <option value="Certificates">Certificates</option>
            <option value="Licenses">Licenses</option>
            <option value="Internal">Internal</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="media" className="text-sm font-semibold">Media (Trade Type) *</Label>
          <select id="media" name="media" className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm" defaultValue={initialData?.media || "COMMON"}>
            <option value="COMMON">Import + Export (Common)</option>
            <option value="IMPORT">Import Only</option>
            <option value="EXPORT">Export Only</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="transportMode" className="text-sm font-semibold">Transport Mode *</Label>
          <select id="transportMode" name="transportMode" className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm" defaultValue={initialData?.transportMode || "MULTIMODAL"}>
            <option value="MULTIMODAL">Multimodal (All)</option>
            <option value="SEA">Sea Only</option>
            <option value="AIR">Air Only</option>
            <option value="ROAD">Land Only</option>
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="sortOrder" className="text-sm font-semibold">Display Order *</Label>
          <Input id="sortOrder" name="sortOrder" type="number" required defaultValue={initialData?.sortOrder ?? 0} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="countryRestriction" className="text-sm font-semibold">Country Restriction (optional)</Label>
          <Input id="countryRestriction" name="countryRestriction" defaultValue={initialData?.countryRestriction || ""} placeholder="Comma separated, e.g. BD,US" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="incotermRestriction" className="text-sm font-semibold">Incoterm Restriction (optional)</Label>
          <Input id="incotermRestriction" name="incotermRestriction" defaultValue={initialData?.incotermRestriction || ""} placeholder="Comma separated, e.g. FOB,CIF" />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="workflowStage" className="text-sm font-semibold">Workflow Stage / Trigger Code (optional)</Label>
        <Input id="workflowStage" name="workflowStage" defaultValue={initialData?.workflowStage || ""} placeholder="e.g. CUSTOMS_CLEARED" />
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Checklist & Blocker Rules</h4>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="isRequired" value="true" className="rounded border-slate-300" defaultChecked={initialData ? initialData.isRequired : true} />
            <span>Is Required (Checklist Visible)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="isOptional" value="true" className="rounded border-slate-300" defaultChecked={initialData?.isOptional ?? false} />
            <span>Is Optional</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-amber-800 font-semibold">
            <input type="checkbox" name="mandatoryBeforeJobClose" value="true" className="rounded border-slate-300" defaultChecked={initialData?.mandatoryBeforeJobClose ?? false} />
            <span>Mandatory Before Job Close</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-amber-800 font-semibold">
            <input type="checkbox" name="mandatoryBeforeInvoice" value="true" className="rounded border-slate-300" defaultChecked={initialData?.mandatoryBeforeInvoice ?? false} />
            <span>Mandatory Before Invoice Generation</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-amber-800 font-semibold">
            <input type="checkbox" name="mandatoryBeforeDeliveryOrder" value="true" className="rounded border-slate-300" defaultChecked={initialData?.mandatoryBeforeDeliveryOrder ?? false} />
            <span>Mandatory Before Delivery Order Release</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-amber-800 font-semibold">
            <input type="checkbox" name="mandatoryBeforeFinanceClose" value="true" className="rounded border-slate-300" defaultChecked={initialData?.mandatoryBeforeFinanceClose ?? false} />
            <span>Mandatory Before Finance Close</span>
          </label>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h4 className="text-sm font-semibold text-slate-800 mb-2">Cargo Trigger Conditions</h4>
        <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="lcRequired" value="true" className="rounded border-slate-300" defaultChecked={initialData?.lcRequired ?? false} />
            <span>LC Required Cargo</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="ttRequired" value="true" className="rounded border-slate-300" defaultChecked={initialData?.ttRequired ?? false} />
            <span>TT Required Cargo</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="hazardousCargo" value="true" className="rounded border-slate-300" defaultChecked={initialData?.hazardousCargo ?? false} />
            <span>Hazardous Cargo</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="perishableCargo" value="true" className="rounded border-slate-300" defaultChecked={initialData?.perishableCargo ?? false} />
            <span>Perishable Cargo</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="temperatureControlled" value="true" className="rounded border-slate-300" defaultChecked={initialData?.temperatureControlled ?? false} />
            <span>Temperature Controlled Cargo</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="containerRequired" value="true" className="rounded border-slate-300" defaultChecked={initialData?.containerRequired ?? false} />
            <span>Container Required (FCL / Containerized)</span>
          </label>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description" className="text-sm font-semibold">Description</Label>
        <textarea id="description" name="description" className="w-full min-h-[60px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none" defaultValue={initialData?.description || ""} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="helpText" className="text-sm font-semibold">Help Text / Upload Guidelines for Client</Label>
        <textarea id="helpText" name="helpText" className="w-full min-h-[60px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none" defaultValue={initialData?.helpText || ""} />
      </div>

      <label className="flex items-center gap-2 cursor-pointer pt-2">
        <input type="checkbox" name="isActive" value="true" className="rounded border-slate-300" defaultChecked={initialData ? initialData.isActive : true} />
        <span className="text-sm font-semibold">Is Active</span>
      </label>

      {state.message && (
        <p className={`text-sm p-3 rounded-md ${state.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {state.message}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>{initialData?.id ? "Update Configuration" : "Create Master Item"}</Button>
      </div>
    </form>
  );
}
