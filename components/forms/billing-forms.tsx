"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { chargeTypes, currencies } from "@/lib/validators/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; name: string };
type ShipmentOption = { id: string; jobNo: string; customerId?: string };
type QuotationOption = {
  id: string;
  quoteNo: string;
  customerId?: string;
  shipmentJobId?: string | null;
  currency?: string;
  lines?: BillingLine[];
};
type BillingLine = {
  description?: unknown;
  chargeType?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  remarks?: unknown;
};

const initialState: ActionState = {};
const inputClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm";

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function dateValue(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function FormAlert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div className={state.ok ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700" : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"}>
      {state.message}
    </div>
  );
}

function LinesEditor({ initialLines }: { initialLines?: BillingLine[] }) {
  const [lines, setLines] = useState<BillingLine[]>(
    initialLines?.length ? initialLines : [{ quantity: 1, unitPrice: 0 }],
  );
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Line items</Label>
        <Button type="button" size="sm" variant="secondary" onClick={() => setLines((current) => [...current, { quantity: 1, unitPrice: 0 }])}>
          <Plus className="h-4 w-4" /> Add line
        </Button>
      </div>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-3 rounded-md border border-slate-200 p-3 md:grid-cols-2 xl:grid-cols-[2fr_1fr_0.7fr_1fr_2fr_auto]">
          <Field label="Description" name={`lineDescription-${index}`}><Input id={`lineDescription-${index}`} name="lineDescription" defaultValue={text(line.description)} required /></Field>
          <Field label="Charge type" name={`lineChargeType-${index}`}><select id={`lineChargeType-${index}`} name="lineChargeType" defaultValue={text(line.chargeType)} className={inputClass}>
            <option value="">Select type</option>
            {chargeTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
          </select></Field>
          <Field label="Quantity" name={`lineQuantity-${index}`}><Input id={`lineQuantity-${index}`} name="lineQuantity" type="number" min="0.001" step="0.001" defaultValue={text(line.quantity) || "1"} required /></Field>
          <Field label="Unit price" name={`lineUnitPrice-${index}`}><Input id={`lineUnitPrice-${index}`} name="lineUnitPrice" type="number" min="0" step="0.01" defaultValue={text(line.unitPrice) || "0"} required /></Field>
          <Field label="Line remarks" name={`lineRemarks-${index}`}><Input id={`lineRemarks-${index}`} name="lineRemarks" defaultValue={text(line.remarks)} /></Field>
          <Button aria-label={`Remove line ${index + 1}`} title={`Remove line ${index + 1}`} type="button" size="icon" variant="outline" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

export function InvoiceForm({
  action,
  invoice,
  customers,
  shipments,
  quotations,
}: {
  action: FormAction;
  invoice?: Record<string, unknown> | null;
  customers: Option[];
  shipments: ShipmentOption[];
  quotations: QuotationOption[];
}) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const lines = (invoice?.lines as BillingLine[] | undefined) ?? [];
  const [sourceLines, setSourceLines] = useState<BillingLine[]>(lines);
  const [lineVersion, setLineVersion] = useState(0);

  function setField(name: string, value?: string | null) {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
      field.value = value ?? "";
    }
  }

  function fillFromShipment(shipmentId: string) {
    const shipment = shipments.find((item) => item.id === shipmentId);
    if (!shipment) return;
    setField("customerId", shipment.customerId);
    const matchingQuotation = quotations.find((item) => item.shipmentJobId === shipment.id);
    if (matchingQuotation) setField("quotationId", matchingQuotation.id);
  }

  function fillFromQuotation(quotationId: string) {
    const quotation = quotations.find((item) => item.id === quotationId);
    if (!quotation) return;
    setField("customerId", quotation.customerId);
    setField("shipmentJobId", quotation.shipmentJobId);
    setField("currency", quotation.currency);
    if (quotation.lines?.length) {
      setSourceLines(quotation.lines);
      setLineVersion((current) => current + 1);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={text(invoice?.id)} />
      {!invoice ? <div className="rounded-md border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">Select a quotation or shipment number below. Customer, shipment link, currency and quotation charge lines will auto-fill when available.</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Select name="customerId" label="Customer" value={text(invoice?.customerId)} options={customers.map((item) => ({ value: item.id, label: item.name }))} required />
        <Select name="shipmentJobId" label="Shipment number" value={text(invoice?.shipmentJobId)} options={shipments.map((item) => ({ value: item.id, label: item.jobNo }))} onChange={fillFromShipment} />
        <Select name="quotationId" label="Quotation number" value={text(invoice?.quotationId)} options={quotations.map((item) => ({ value: item.id, label: item.quoteNo }))} onChange={fillFromQuotation} />
        <Field label="Invoice date"><Input name="invoiceDate" type="date" defaultValue={dateValue(invoice?.invoiceDate) || new Date().toISOString().slice(0, 10)} required /></Field>
        <Field label="Due date"><Input name="dueDate" type="date" defaultValue={dateValue(invoice?.dueDate)} /></Field>
        <Select
          name="currency"
          label="Currency"
          value={text(invoice?.currency) || "BDT"}
          options={currencies.map((item) => ({ value: item, label: item }))}
          required
          onChange={async (val) => {
            const rateInput = document.getElementsByName("exchangeRateToBDT")[0] as HTMLInputElement;
            if (!rateInput) return;
            if (val === "BDT") {
              rateInput.value = "1";
              return;
            }
            try {
              const labelEl = rateInput.parentElement?.querySelector("label");
              const originalLabel = labelEl?.textContent || "FX to BDT";
              if (labelEl) labelEl.textContent = "Fetching FX...";
              const res = await fetch(`https://open.er-api.com/v6/latest/${val}`);
              const data = await res.json();
              if (labelEl) labelEl.textContent = originalLabel;
              if (data?.result === "success" && data?.rates?.BDT) {
                rateInput.value = Number(data.rates.BDT).toFixed(4);
              }
            } catch (err) {
              console.error("Failed to fetch live FX rate:", err);
            }
          }}
        />
        <Field label="FX to BDT"><Input name="exchangeRateToBDT" type="number" min="0.0001" step="0.0001" defaultValue={text(invoice?.exchangeRateToBDT) || "1"} required /></Field>
        <Field label="Discount"><Input name="discountAmount" type="number" min="0" step="0.01" defaultValue={text(invoice?.discountAmount) || "0"} /></Field>
        <Field label="Tax"><Input name="taxAmount" type="number" min="0" step="0.01" defaultValue={text(invoice?.taxAmount) || "0"} /></Field>
      </div>
      <LinesEditor key={lineVersion} initialLines={sourceLines} />
      <Field label="Invoice remarks" name="remarks"><textarea id="remarks" name="remarks" defaultValue={text(invoice?.remarks)} className="min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm" /></Field>
      <Button type="submit"><Save className="h-4 w-4" />{invoice ? "Update invoice" : "Create invoice"}</Button>
    </form>
  );
}

export function VendorBillForm({
  action,
  bill,
  vendors,
  shipments,
}: {
  action: FormAction;
  bill?: Record<string, unknown> | null;
  vendors: Option[];
  shipments: ShipmentOption[];
}) {
  const [state, formAction] = useActionState(action, initialState);
  const lines = (bill?.lines as BillingLine[] | undefined) ?? [];
  return (
    <form action={formAction} className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" value={text(bill?.id)} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Select name="vendorId" label="Vendor" value={text(bill?.vendorId)} options={vendors.map((item) => ({ value: item.id, label: item.name }))} required />
        <Select name="shipmentJobId" label="Shipment" value={text(bill?.shipmentJobId)} options={shipments.map((item) => ({ value: item.id, label: item.jobNo }))} />
        <Field label="Bill date"><Input name="billDate" type="date" defaultValue={dateValue(bill?.billDate) || new Date().toISOString().slice(0, 10)} required /></Field>
        <Field label="Due date"><Input name="dueDate" type="date" defaultValue={dateValue(bill?.dueDate)} /></Field>
        <Select
          name="currency"
          label="Currency"
          value={text(bill?.currency) || "BDT"}
          options={currencies.map((item) => ({ value: item, label: item }))}
          required
          onChange={async (val) => {
            const rateInput = document.getElementsByName("exchangeRateToBDT")[0] as HTMLInputElement;
            if (!rateInput) return;
            if (val === "BDT") {
              rateInput.value = "1";
              return;
            }
            try {
              const labelEl = rateInput.parentElement?.querySelector("label");
              const originalLabel = labelEl?.textContent || "FX to BDT";
              if (labelEl) labelEl.textContent = "Fetching FX...";
              const res = await fetch(`https://open.er-api.com/v6/latest/${val}`);
              const data = await res.json();
              if (labelEl) labelEl.textContent = originalLabel;
              if (data?.result === "success" && data?.rates?.BDT) {
                rateInput.value = Number(data.rates.BDT).toFixed(4);
              }
            } catch (err) {
              console.error("Failed to fetch live FX rate:", err);
            }
          }}
        />
        <Field label="FX to BDT"><Input name="exchangeRateToBDT" type="number" min="0.0001" step="0.0001" defaultValue={text(bill?.exchangeRateToBDT) || "1"} required /></Field>
        <Field label="Discount"><Input name="discountAmount" type="number" min="0" step="0.01" defaultValue={text(bill?.discountAmount) || "0"} /></Field>
        <Field label="Tax"><Input name="taxAmount" type="number" min="0" step="0.01" defaultValue={text(bill?.taxAmount) || "0"} /></Field>
      </div>
      <LinesEditor initialLines={lines} />
      <Field label="Vendor bill remarks" name="remarks"><textarea id="remarks" name="remarks" defaultValue={text(bill?.remarks)} className="min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm" /></Field>
      <Button type="submit"><Save className="h-4 w-4" />{bill ? "Update vendor bill" : "Create vendor bill"}</Button>
    </form>
  );
}

export function PaymentForm({
  action,
  direction,
  customers,
  vendors,
  shipments,
  invoices,
  vendorBills,
}: {
  action: FormAction;
  direction: "RECEIVED" | "PAID";
  customers: Option[];
  vendors: Option[];
  shipments: ShipmentOption[];
  invoices: { id: string; invoiceNo: string; customerId: string; dueAmount: string }[];
  vendorBills: { id: string; billNo: string; vendorId: string; dueAmount: string }[];
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="direction" value={direction} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {direction === "RECEIVED" ? (
          <>
            <Select name="customerId" label="Customer" value="" options={customers.map((item) => ({ value: item.id, label: item.name }))} required />
            <Select name="invoiceId" label="Invoice" value="" options={invoices.map((item) => ({ value: item.id, label: `${item.invoiceNo} — due ${Number(item.dueAmount).toFixed(2)}` }))} />
          </>
        ) : (
          <>
            <Select name="vendorId" label="Vendor" value="" options={vendors.map((item) => ({ value: item.id, label: item.name }))} required />
            <Select name="vendorBillId" label="Vendor bill" value="" options={vendorBills.map((item) => ({ value: item.id, label: `${item.billNo} — due ${Number(item.dueAmount).toFixed(2)}` }))} />
          </>
        )}
        <Select name="shipmentJobId" label="Shipment" value="" options={shipments.map((item) => ({ value: item.id, label: item.jobNo }))} />
        <Field label="Payment date"><Input name="paymentDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></Field>
        <Select name="paymentMethod" label="Method" value="BANK_TRANSFER" options={["CASH", "BANK_TRANSFER", "CHEQUE", "MOBILE_BANKING", "CARD", "OTHER"].map((item) => ({ value: item, label: item.replaceAll("_", " ") }))} required />
        <Field label="Reference"><Input name="referenceNo" /></Field>
        <Select
          name="currency"
          label="Currency"
          value="BDT"
          options={currencies.map((item) => ({ value: item, label: item }))}
          required
          onChange={async (val) => {
            const rateInput = document.getElementsByName("exchangeRateToBDT")[0] as HTMLInputElement;
            if (!rateInput) return;
            if (val === "BDT") {
              rateInput.value = "1";
              return;
            }
            try {
              const labelEl = rateInput.parentElement?.querySelector("label");
              const originalLabel = labelEl?.textContent || "FX to BDT";
              if (labelEl) labelEl.textContent = "Fetching FX...";
              const res = await fetch(`https://open.er-api.com/v6/latest/${val}`);
              const data = await res.json();
              if (labelEl) labelEl.textContent = originalLabel;
              if (data?.result === "success" && data?.rates?.BDT) {
                rateInput.value = Number(data.rates.BDT).toFixed(4);
              }
            } catch (err) {
              console.error("Failed to fetch live FX rate:", err);
            }
          }}
        />
        <Field label="FX to BDT"><Input name="exchangeRateToBDT" type="number" min="0.0001" step="0.0001" defaultValue="1" required /></Field>
        <Field label="Amount"><Input name="amount" type="number" min="0.01" step="0.01" required /></Field>
      </div>
      <Field label="Payment remarks" name="remarks"><textarea id="remarks" name="remarks" className="min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm" /></Field>
      <Button type="submit"><Save className="h-4 w-4" />Record {direction === "RECEIVED" ? "receipt" : "payment"}</Button>
    </form>
  );
}

function Field({ label, children, name }: { label: string; children: React.ReactNode; name?: string }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label>{children}</div>;
}

function Select({ name, label, value, options, required, onChange }: { name: string; label: string; value: string; options: { value: string; label: string }[]; required?: boolean; onChange?: (value: string) => void }) {
  return (
    <Field label={label} name={name}>
      <select id={name} name={name} defaultValue={value} required={required} onChange={(event) => onChange?.(event.target.value)} className={inputClass}>
        <option value="">{required ? `Select ${label.toLowerCase()}` : "Not linked"}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </Field>
  );
}
