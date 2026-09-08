"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import {
  chargeBasisValues,
  chargeTypes,
  currencies,
  loadTypes,
  shipmentTypes,
  tradeTerms,
  transportModes,
} from "@/lib/validators/finance";
import { generateQuotationChargeDraftAction } from "@/lib/actions/ai-generative-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const initialState: ActionState = {};

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs font-medium text-red-600">{errors[0]}</p>;
}

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

function toValue(value: unknown) {
  return value == null ? "" : String(value);
}

function dateValue(value: unknown) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

type QuotationChargeLine = {
  id?: unknown;
  chargeName?: unknown;
  chargeType?: unknown;
  chargeBasis?: unknown;
  currency?: unknown;
  quantity?: unknown;
  buyRate?: unknown;
  sellRate?: unknown;
  exchangeRateToBDT?: unknown;
  vendorId?: unknown;
  remarks?: unknown;
};

const chargeInputClass =
  "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm";

function QuotationChargesEditor({
  initialCharges,
  vendors,
}: {
  initialCharges?: QuotationChargeLine[];
  vendors: { id: string; name: string }[];
}) {
  const [lines, setLines] = useState<QuotationChargeLine[]>(
    initialCharges?.length
      ? initialCharges
      : [{ chargeType: "FREIGHT", chargeBasis: "PER_SHIPMENT", currency: "BDT", quantity: 1, buyRate: 0, sellRate: 0, exchangeRateToBDT: 1 }],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Charge lines</Label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            setLines((current) => [
              ...current,
              {
                chargeType: "FREIGHT",
                chargeBasis: "PER_SHIPMENT",
                currency: "BDT",
                quantity: 1,
                buyRate: 0,
                sellRate: 0,
                exchangeRateToBDT: 1,
              },
            ])
          }
        >
          <Plus className="h-4 w-4" />
          Add charge line
        </Button>
      </div>
      {lines.map((line, index) => (
        <div
          key={line.id ? String(line.id) : `new-${index}`}
          className="space-y-3 rounded-md border border-slate-200 p-3"
        >
          <input type="hidden" name="chargeId" defaultValue={toValue(line.id)} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor={`chargeName-${index}`}>Charge name</Label>
              <Input id={`chargeName-${index}`} name="chargeName" defaultValue={toValue(line.chargeName)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`chargeType-${index}`}>Charge type</Label>
              <select id={`chargeType-${index}`} name="chargeType" defaultValue={toValue(line.chargeType) || "FREIGHT"} className={chargeInputClass}>
                {chargeTypes.map((type) => (
                  <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`chargeBasis-${index}`}>Charge basis</Label>
              <select id={`chargeBasis-${index}`} name="chargeBasis" defaultValue={toValue(line.chargeBasis) || "PER_SHIPMENT"} className={chargeInputClass}>
                {chargeBasisValues.map((basis) => (
                  <option key={basis} value={basis}>{basis.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`chargeCurrency-${index}`}>Currency</Label>
              <select
                id={`chargeCurrency-${index}`}
                name="chargeCurrency"
                defaultValue={toValue(line.currency) || "BDT"}
                className={chargeInputClass}
                onChange={async (e) => {
                  const val = e.target.value;
                  const rateInput = document.getElementById(`chargeExchangeRateToBDT-${index}`) as HTMLInputElement;
                  if (!rateInput) return;
                  if (val === "BDT") {
                    rateInput.value = "1";
                    return;
                  }
                  try {
                    const labelEl = rateInput.parentElement?.querySelector("label");
                    const originalLabel = labelEl?.textContent || "Exchange rate to BDT";
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
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <NamedInput name="chargeQuantity" label="Quantity" type="number" min="0" step="0.001" defaultValue={toValue(line.quantity) || "1"} />
            <NamedInput name="chargeBuyRate" label="Buy rate (internal)" type="number" min="0" step="0.01" defaultValue={toValue(line.buyRate) || "0"} />
            <NamedInput name="chargeSellRate" label="Sell rate" type="number" min="0" step="0.01" defaultValue={toValue(line.sellRate) || "0"} />
            <NamedInput id={`chargeExchangeRateToBDT-${index}`} name="chargeExchangeRateToBDT" label="Exchange rate to BDT" type="number" min="0.0001" step="0.0001" defaultValue={toValue(line.exchangeRateToBDT) || "1"} />
            <div className="space-y-2">
              <Label htmlFor={`chargeVendorId-${index}`}>Vendor / provider</Label>
              <select id={`chargeVendorId-${index}`} name="chargeVendorId" defaultValue={toValue(line.vendorId)} className={chargeInputClass}>
                <option value="">No vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <NamedInput name="chargeRemarks" label="Charge remarks" defaultValue={toValue(line.remarks)} />
            </div>
            <Button
              aria-label={`Remove charge line ${index + 1}`}
              title={`Remove charge line ${index + 1}`}
              type="button"
              size="icon"
              variant="outline"
              disabled={lines.length === 1}
              onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuotationForm({
  action,
  quotation,
  companyId,
  isSuperAdmin,
  companies,
  customers,
  shipments,
  charges,
  vendors = [],
  canUseAi = false,
}: {
  action: FormAction;
  quotation?: Record<string, unknown> | null;
  companyId: string;
  isSuperAdmin: boolean;
  companies: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  shipments: Array<{
    id: string;
    jobNo: string;
    customerId?: string;
    shipmentType?: string;
    transportMode?: string;
    loadType?: string;
    tradeTerm?: string | null;
    originCountry?: string;
    originPort?: string | null;
    destinationCountry?: string;
    destinationPort?: string | null;
    cargoDescription?: string;
    packageCount?: number | null;
    grossWeight?: string | null;
    chargeableWeight?: string | null;
    cbm?: string | null;
  }>;
  charges?: QuotationChargeLine[];
  vendors?: { id: string; name: string }[];
  canUseAi?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [aiCharges, setAiCharges] = useState<QuotationChargeLine[] | undefined>(undefined);
  const [editorKey, setEditorKey] = useState(0);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isGeneratingAi, startGeneratingAi] = useTransition();

  function fillFromShipment(shipmentId: string) {
    const shipment = shipments.find((item) => item.id === shipmentId);
    if (!shipment || !formRef.current) return;
    for (const [name, value] of Object.entries(shipment)) {
      if (name === "id" || name === "jobNo") continue;
      const field = formRef.current.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.value = value == null ? "" : String(value);
      }
    }
  }

  function fieldValue(name: string) {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      return field.value.trim();
    }
    return "";
  }

  function handleGenerateWithAi() {
    const transportMode = fieldValue("transportMode");
    const originCountry = fieldValue("originCountry");
    const destinationCountry = fieldValue("destinationCountry");
    if (!transportMode || !originCountry || !destinationCountry) {
      setAiError("Fill in transport mode, origin country, and destination country first.");
      return;
    }

    setAiError(null);
    startGeneratingAi(async () => {
      const result = await generateQuotationChargeDraftAction({
        transportMode: transportMode as (typeof transportModes)[number],
        loadType: fieldValue("loadType") || undefined,
        originCountry,
        destinationCountry,
        cargoDescription: fieldValue("cargoDescription") || undefined,
        packageCount: Number(fieldValue("packageCount")) || undefined,
        grossWeight: Number(fieldValue("grossWeight")) || undefined,
        chargeableWeight: Number(fieldValue("chargeableWeight")) || undefined,
        cbm: Number(fieldValue("cbm")) || undefined,
      });
      if (!result.ok) {
        setAiError(result.message);
        return;
      }
      setAiCharges(
        result.charges.map((c) => ({
          chargeName: c.chargeName,
          chargeType: c.chargeType,
          chargeBasis: c.chargeBasis,
          currency: c.currency,
          quantity: c.quantity,
          buyRate: c.buyRate,
          sellRate: c.sellRate,
          exchangeRateToBDT: 1,
          remarks: c.remarks,
        })),
      );
      setEditorKey((key) => key + 1);
    });
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={toValue(quotation?.id)} />
      {isSuperAdmin ? (
        <div className="space-y-2">
          <Label htmlFor="companyId">Company</Label>
          <select id="companyId" name="companyId" defaultValue={companyId} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="companyId" value={companyId} />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="customerId">Customer</Label>
          <select id="customerId" name="customerId" defaultValue={toValue(quotation?.customerId)} required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
          <FieldError errors={state.errors?.customerId} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shipmentJobId">Linked shipment</Label>
          <select id="shipmentJobId" name="shipmentJobId" defaultValue={toValue(quotation?.shipmentJobId)} onChange={(event) => fillFromShipment(event.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">Not linked</option>
            {shipments.map((shipment) => (
              <option key={shipment.id} value={shipment.id}>{shipment.jobNo}</option>
            ))}
          </select>
          <FieldError errors={state.errors?.shipmentJobId} />
        </div>
        <SelectField name="shipmentType" label="Shipment type" value={toValue(quotation?.shipmentType)} options={shipmentTypes} required errors={state.errors?.shipmentType} />
        <SelectField name="transportMode" label="Transport mode" value={toValue(quotation?.transportMode)} options={transportModes} required errors={state.errors?.transportMode} />
        <SelectField name="loadType" label="Load type" value={toValue(quotation?.loadType)} options={loadTypes} />
        <SelectField name="tradeTerm" label="Trade term" value={toValue(quotation?.tradeTerm)} options={tradeTerms} />
        <div className="space-y-2">
          <Label htmlFor="originCountry">Origin country</Label>
          <Input id="originCountry" name="originCountry" defaultValue={toValue(quotation?.originCountry)} required />
          <FieldError errors={state.errors?.originCountry} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="destinationCountry">Destination country</Label>
          <Input id="destinationCountry" name="destinationCountry" defaultValue={toValue(quotation?.destinationCountry)} required />
          <FieldError errors={state.errors?.destinationCountry} />
        </div>
        <NamedInput name="originPort" label="Origin port" defaultValue={toValue(quotation?.originPort)} />
        <NamedInput name="destinationPort" label="Destination port" defaultValue={toValue(quotation?.destinationPort)} />
        <NamedInput name="validUntil" label="Valid until" type="date" defaultValue={dateValue(quotation?.validUntil)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NamedInput name="packageCount" label="Package count" type="number" min="0" defaultValue={toValue(quotation?.packageCount)} />
        <NamedInput name="grossWeight" label="Gross weight" type="number" min="0" step="0.001" defaultValue={toValue(quotation?.grossWeight)} />
        <NamedInput name="chargeableWeight" label="Chargeable weight" type="number" min="0" step="0.001" defaultValue={toValue(quotation?.chargeableWeight)} />
        <NamedInput name="cbm" label="CBM" type="number" min="0" step="0.001" defaultValue={toValue(quotation?.cbm)} />
      </div>

      <div className="space-y-2"><Label htmlFor="cargoDescription">Cargo description</Label><textarea id="cargoDescription" name="cargoDescription" defaultValue={toValue(quotation?.cargoDescription)} className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" /></div>
      <div className="space-y-2"><Label htmlFor="quotationRemarks">Quotation remarks / terms</Label><textarea id="quotationRemarks" name="remarks" defaultValue={toValue(quotation?.remarks)} className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm" /></div>

      {canUseAi && (
        <div className="space-y-2">
          <Button type="button" size="sm" variant="outline" disabled={isGeneratingAi} onClick={handleGenerateWithAi}>
            {isGeneratingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-purple-600" />}
            Generate charges with AI
          </Button>
          <p className="text-[10px] text-slate-500">* Fills the charge lines below as a draft -- review and edit before saving.</p>
          {aiError && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}
        </div>
      )}

      <QuotationChargesEditor key={editorKey} initialCharges={aiCharges ?? charges} vendors={vendors} />

      <Button type="submit">
        <Save className="h-4 w-4" />
        {quotation ? "Update quotation" : "Create quotation"}
      </Button>
    </form>
  );
}

function NamedInput({ name, label, ...props }: React.ComponentProps<typeof Input> & { name: string; label: string }) {
  const inputId = props.id || name;
  return <div className="space-y-2"><Label htmlFor={inputId}>{label}</Label><Input id={inputId} name={name} {...props} /></div>;
}

function SelectField({
  name,
  label,
  value,
  options,
  required = false,
  errors,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly string[];
  required?: boolean;
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} defaultValue={value} required={required} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
        <option value="">Not set</option>
        {options.map((option) => (
          <option key={option} value={option}>{option.replaceAll("_", " ")}</option>
        ))}
      </select>
      <FieldError errors={errors} />
    </div>
  );
}

export function ChargeForm({
  action,
  quotationId,
  vendors,
  charge,
}: {
  action: FormAction;
  quotationId: string;
  vendors: { id: string; name: string }[];
  charge?: Record<string, unknown> | null;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      router.refresh();
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="space-y-3">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={toValue(charge?.id)} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <ChargeFields state={state} vendors={vendors} item={charge} />
      <Button type="submit" size="sm" variant="secondary">
        <Plus className="h-4 w-4" />
        {charge ? "Update charge" : "Add charge"}
      </Button>
    </form>
  );
}

export function ShipmentCostForm({
  action,
  shipmentJobId,
  vendors,
  customers,
  quotations,
  item,
}: {
  action: FormAction;
  shipmentJobId: string;
  vendors: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  quotations: { id: string; quoteNo: string }[];
  item?: Record<string, unknown> | null;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={toValue(item?.id)} />
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <ChargeFields state={state} vendors={vendors} item={item} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customerId">Linked customer</Label>
          <select id="customerId" name="customerId" defaultValue={toValue(item?.customerId)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">No customer link</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>{customer.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sourceQuotationId">Source quotation number</Label>
          <select id="sourceQuotationId" name="sourceQuotationId" defaultValue={toValue(item?.sourceQuotationId)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">No quotation source</option>
            {quotations.map((quotation) => (
              <option key={quotation.id} value={quotation.id}>{quotation.quoteNo}</option>
            ))}
          </select>
        </div>
      </div>
      <Button type="submit" size="sm" variant="secondary">
        <Plus className="h-4 w-4" />
        {item ? "Update cost item" : "Add cost item"}
      </Button>
    </form>
  );
}

function ChargeFields({
  state,
  vendors,
  item,
}: {
  state: ActionState;
  vendors: { id: string; name: string }[];
  item?: Record<string, unknown> | null;
}) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="chargeName">Charge name</Label>
          <Input id="chargeName" name="chargeName" defaultValue={toValue(item?.chargeName)} required />
          <FieldError errors={state.errors?.chargeName} />
        </div>
        <div className="space-y-2"><Label htmlFor="chargeType">Charge type</Label><select id="chargeType" name="chargeType" defaultValue={toValue(item?.chargeType) || "FREIGHT"} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
          {chargeTypes.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select></div>
        <div className="space-y-2"><Label htmlFor="chargeBasis">Charge basis</Label><select id="chargeBasis" name="chargeBasis" defaultValue={toValue(item?.chargeBasis) || "PER_SHIPMENT"} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
          {chargeBasisValues.map((basis) => <option key={basis} value={basis}>{basis.replaceAll("_", " ")}</option>)}
        </select></div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <select
            id="currency"
            name="currency"
            defaultValue={toValue(item?.currency) || "BDT"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            onChange={async (e) => {
              const val = e.target.value;
              const rateInput = document.getElementById("exchangeRateToBDT") as HTMLInputElement;
              if (!rateInput) return;
              if (val === "BDT") {
                rateInput.value = "1";
                return;
              }
              try {
                const labelEl = rateInput.parentElement?.querySelector("label");
                const originalLabel = labelEl?.textContent || "Exchange rate to BDT";
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
          >
            {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <NamedInput name="quantity" label="Quantity" type="number" min="0" step="0.001" defaultValue={toValue(item?.quantity) || "1"} />
        <NamedInput name="buyRate" label="Buy rate (internal)" type="number" min="0" step="0.01" defaultValue={toValue(item?.buyRate) || "0"} />
        <NamedInput name="sellRate" label="Sell rate" type="number" min="0" step="0.01" defaultValue={toValue(item?.sellRate) || "0"} />
        <NamedInput id="exchangeRateToBDT" name="exchangeRateToBDT" label="Exchange rate to BDT" type="number" min="0.0001" step="0.0001" defaultValue={toValue(item?.exchangeRateToBDT) || "1"} />
        <div className="space-y-2"><Label htmlFor="vendorId">Vendor / provider</Label><select id="vendorId" name="vendorId" defaultValue={toValue(item?.vendorId)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">
          <option value="">No vendor</option>
          {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
        </select></div>
      </div>
      <NamedInput name="remarks" label="Charge remarks" defaultValue={toValue(item?.remarks)} />
    </>
  );
}
