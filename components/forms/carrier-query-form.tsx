"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type SourceRecord = {
  id: string;
  label: string;
  data: Record<string, string | number | null>;
};

type VendorOption = {
  id: string;
  name: string;
  type: string;
  hasEmail: boolean;
};

const fieldClass = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100";

function Field({ name, label, children }: { name: string; label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label>{children}</div>;
}

function vendorTypesForMode(mode: string) {
  if (mode === "SEA") return ["SHIPPING_LINE"];
  if (mode === "AIR") return ["AIRLINE"];
  if (mode === "LAND") return ["TRUCK_VENDOR"];
  return ["SHIPPING_LINE", "AIRLINE", "TRUCK_VENDOR"];
}

export function CarrierQueryForm({
  action, blastAction, vendors, requests, shipments, defaultRequestId, defaultShipmentId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  blastAction: (formData: FormData) => Promise<{ ok: boolean; message: string; sentCount: number; skippedCount: number }>;
  vendors: VendorOption[];
  requests: SourceRecord[];
  shipments: SourceRecord[];
  defaultRequestId?: string;
  defaultShipmentId?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [blastResult, setBlastResult] = useState<{ ok: boolean; message: string; sentCount: number; skippedCount: number } | null>(null);
  const initialSource = shipments.find((i) => i.id === defaultShipmentId) ?? requests.find((i) => i.id === defaultRequestId);
  const [selectedMode, setSelectedMode] = useState<string>(String(initialSource?.data.mode ?? "SEA"));

  function fill(source?: SourceRecord) {
    if (!source || !formRef.current) return;
    for (const [name, value] of Object.entries(source.data)) {
      const control = formRef.current.elements.namedItem(name);
      if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
        control.value = value == null ? "" : String(value);
        if (name === "mode") setSelectedMode(value == null ? "" : String(value));
      }
    }
  }

  const allowedTypes = vendorTypesForMode(selectedMode);
  const filteredVendors = vendors.filter((v) => allowedTypes.includes(v.type));
  const vendorsWithEmail = filteredVendors.filter((v) => v.hasEmail);
  const vendorsWithoutEmail = filteredVendors.filter((v) => !v.hasEmail);
  const modeLabelMap: Record<string, string> = { SEA: "SHIPPING LINE", AIR: "AIRLINE", LAND: "TRUCK VENDOR" };

  function handleBlast() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    setBlastResult(null);
    startTransition(async () => {
      const result = await blastAction(formData);
      setBlastResult(result);
    });
  }

  return (
    <div className="space-y-6">
      <form ref={formRef} action={action} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 rounded-md border border-cyan-200 bg-cyan-50 dark:bg-cyan-950/30 p-3 text-sm text-cyan-900 dark:text-cyan-300">
          Select a request or shipment tracking number to auto-fill route and cargo information.
        </div>
        <Field name="shipmentRequestId" label="Shipment request number">
          <select id="shipmentRequestId" name="shipmentRequestId" defaultValue={defaultRequestId ?? ""} onChange={(e) => fill(requests.find((r) => r.id === e.target.value))} className={fieldClass}>
            <option value="">None</option>
            {requests.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </Field>
        <Field name="shipmentJobId" label="Shipment number">
          <select id="shipmentJobId" name="shipmentJobId" defaultValue={defaultShipmentId ?? ""} onChange={(e) => fill(shipments.find((s) => s.id === e.target.value))} className={fieldClass}>
            <option value="">None</option>
            {shipments.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
        <Field name="vendorId" label="Provider">
          <select id="vendorId" name="vendorId" className={fieldClass}>
            <option value="">Select provider</option>
            {filteredVendors.map((v) => <option key={v.id} value={v.id}>{v.name}{!v.hasEmail ? " (no email)" : ""}</option>)}
          </select>
        </Field>
        <Field name="mode" label="Transport mode">
          <select id="mode" name="mode" value={selectedMode} onChange={(e) => setSelectedMode(e.target.value)} className={fieldClass}>
            <option>SEA</option>
            <option>AIR</option>
            <option value="LAND">ROAD</option>
          </select>
        </Field>
        <Field name="origin" label="Origin"><input id="origin" name="origin" defaultValue={String(initialSource?.data.origin ?? "")} className={fieldClass} /></Field>
        <Field name="destination" label="Destination"><input id="destination" name="destination" defaultValue={String(initialSource?.data.destination ?? "")} className={fieldClass} /></Field>
        <div className="md:col-span-2"><Field name="cargoSummary" label="Cargo summary"><textarea id="cargoSummary" required name="cargoSummary" defaultValue={String(initialSource?.data.cargoSummary ?? "")} className={fieldClass} rows={3} /></Field></div>
        <Field name="hsCode" label="HS code"><input id="hsCode" name="hsCode" defaultValue={String(initialSource?.data.hsCode ?? "")} className={fieldClass} /></Field>
        <Field name="weight" label="Gross weight (KG)"><input id="weight" type="number" step="0.001" name="weight" defaultValue={String(initialSource?.data.weight ?? "")} className={fieldClass} /></Field>
        <Field name="cbm" label="CBM / measurement"><input id="cbm" type="number" step="0.001" name="cbm" defaultValue={String(initialSource?.data.cbm ?? "")} className={fieldClass} /></Field>
        <Field name="packageInfo" label="Package information"><input id="packageInfo" name="packageInfo" defaultValue={String(initialSource?.data.packageInfo ?? "")} className={fieldClass} /></Field>
        <Field name="containerRequirement" label="Container requirement"><input id="containerRequirement" name="containerRequirement" defaultValue={String(initialSource?.data.containerRequirement ?? "")} className={fieldClass} /></Field>
        <Field name="responseDueAt" label="Response due date"><input id="responseDueAt" type="date" name="responseDueAt" className={fieldClass} /></Field>
        <div className="md:col-span-2"><Field name="notes" label="Query notes"><textarea id="notes" name="notes" className={fieldClass} rows={2} /></Field></div>
        <Field name="status" label="Query status"><select id="status" name="status" className={fieldClass}><option>DRAFT</option><option>SENT</option></select></Field>
        <div className="flex items-end"><Button type="submit">Create Single Query</Button></div>
      </form>

      <div className="rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              Send RFQ to All {modeLabelMap[selectedMode] || "Vendors"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Sends one professional email to all matching vendors. Each vendor receives it in <strong>BCC</strong> — they cannot see who else received the query.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-800 dark:bg-slate-600 text-white text-[11px] font-bold px-3 py-1 tracking-wider">BCC</span>
        </div>
        <div className="space-y-2">
          {vendorsWithEmail.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                {vendorsWithEmail.length} vendor{vendorsWithEmail.length > 1 ? "s" : ""} will receive this email
              </p>
              <div className="flex flex-wrap gap-1.5">
                {vendorsWithEmail.map((v) => (
                  <span key={v.id} className="inline-flex items-center gap-1.5 rounded-md bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                    {v.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 p-3 text-sm text-amber-800 dark:text-amber-300">
              No {selectedMode} vendors with email addresses found. Add emails to your vendors first.
            </div>
          )}
          {vendorsWithoutEmail.length > 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {vendorsWithoutEmail.length} vendor{vendorsWithoutEmail.length > 1 ? "s" : ""} skipped (no email): {vendorsWithoutEmail.map((v) => v.name).join(", ")}
            </p>
          )}
        </div>
        {blastResult && (
          <div className={"rounded-lg border px-4 py-3 text-sm flex items-start gap-3 " + (blastResult.ok ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300" : "bg-red-50 dark:bg-red-950/40 border-red-200 text-red-800 dark:text-red-300")}>
            <div>
              <p className="font-semibold">{blastResult.ok ? "Email Sent Successfully!" : "Failed to Send"}</p>
              <p className="text-xs mt-0.5">{blastResult.message}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={handleBlast}
          disabled={isPending || vendorsWithEmail.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 text-sm transition-colors shadow-sm"
        >
          {isPending ? "Sending..." : ("Send RFQ to " + vendorsWithEmail.length + " Vendor" + (vendorsWithEmail.length !== 1 ? "s" : "") + " via BCC")}
        </button>
      </div>
    </div>
  );
}
