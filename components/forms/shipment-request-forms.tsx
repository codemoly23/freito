"use client";

import { useActionState, useState } from "react";
import { Check, FilePenLine, Save, Send, X } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const initialState: ActionState = {};

function value(input: unknown) {
  return input == null ? "" : String(input);
}

function dateValue(input: unknown) {
  if (!input) return "";
  const date = new Date(String(input));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function Alert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={
        state.ok
          ? "rounded-md bg-emerald-50 p-3 text-sm text-emerald-700"
          : "rounded-md bg-red-50 p-3 text-sm text-red-700"
      }
    >
      {state.message}
    </p>
  );
}

function ErrorText({ errors }: { errors?: string[] }) {
  return errors?.length ? (
    <p className="text-xs font-medium text-red-600">{errors[0]}</p>
  ) : null;
}

export function ShipmentRequestForm({
  action,
  request,
  internal = false,
  customers,
}: {
  action: FormAction;
  request?: Record<string, unknown> | null;
  internal?: boolean;
  customers?: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [scope, setScope] = useState(
    value(request?.serviceScope) || "PORT_TO_PORT",
  );
  const pickupRequired =
    scope === "DOOR_TO_PORT" || scope === "DOOR_TO_DOOR";
  const deliveryRequired =
    scope === "PORT_TO_DOOR" || scope === "DOOR_TO_DOOR";

  const [requestedEtd, setRequestedEtd] = useState(dateValue(request?.requestedEtd));
  const [requestedEta, setRequestedEta] = useState(dateValue(request?.requestedEta));
  const [expectedShipmentDate, setExpectedShipmentDate] = useState(
    dateValue(request?.expectedShipmentDate) || dateValue(request?.requestedEtd),
  );
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(
    dateValue(request?.expectedDeliveryDate) || dateValue(request?.requestedEta),
  );

  const handleRequestedEtdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRequestedEtd(val);
    setExpectedShipmentDate(val);
  };

  const handleRequestedEtaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRequestedEta(val);
    setExpectedDeliveryDate(val);
  };

  return (
    <form action={formAction} className="space-y-5">
      <Alert state={state} />
      {request?.id ? (
        <input type="hidden" name="id" value={value(request.id)} />
      ) : null}
      {customers ? (
        <div className="space-y-2">
          <Label htmlFor="customerId">Customer / Client</Label>
          <select
            id="customerId"
            name="customerId"
            defaultValue={value(request?.customerId)}
            required
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Select a customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <ErrorText errors={state.errors?.customerId} />
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Select
          name="shipmentType"
          label="Shipment type"
          defaultValue={value(request?.shipmentType) || "EXPORT"}
          options={["IMPORT", "EXPORT"]}
        />
        <Select
          name="transportMode"
          label="Transport mode"
          defaultValue={value(request?.transportMode) || "SEA"}
          options={["SEA", "AIR", "LAND"]}
        />
        <div className="space-y-2">
          <Label htmlFor="serviceScope">Service scope</Label>
          <select
            id="serviceScope"
            name="serviceScope"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {[
              "PORT_TO_PORT",
              "DOOR_TO_PORT",
              "PORT_TO_DOOR",
              "DOOR_TO_DOOR",
            ].map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <ErrorText errors={state.errors?.serviceScope} />
        </div>
        <Select
          name="loadType"
          label="Load type"
          defaultValue={value(request?.loadType)}
          options={["FCL", "LCL", "AIR_CARGO", "TRUCK"]}
          optional
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="originCountry"
          label="Origin country"
          defaultValue={request?.originCountry}
          errors={state.errors?.originCountry}
          required
        />
        <Field
          name="destinationCountry"
          label="Destination country"
          defaultValue={request?.destinationCountry}
          errors={state.errors?.destinationCountry}
          required
        />
        <Field name="originPort" label="Origin port" defaultValue={request?.originPort} />
        <Field
          name="destinationPort"
          label="Destination port"
          defaultValue={request?.destinationPort}
        />
        <Field
          name="originAddress"
          label="Origin address"
          defaultValue={request?.originAddress}
        />
        <Field
          name="destinationAddress"
          label="Destination address"
          defaultValue={request?.destinationAddress}
        />
        <Field
          name="pickupAddress"
          label={`Pickup address${pickupRequired ? " (required)" : ""}`}
          defaultValue={request?.pickupAddress}
          errors={state.errors?.pickupAddress}
          required={pickupRequired}
        />
        <Field
          name="deliveryAddress"
          label={`Delivery address${deliveryRequired ? " (required)" : ""}`}
          defaultValue={request?.deliveryAddress}
          errors={state.errors?.deliveryAddress}
          required={deliveryRequired}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cargoDescription">Cargo description</Label>
        <textarea
          id="cargoDescription"
          name="cargoDescription"
          defaultValue={value(request?.cargoDescription)}
          required
          className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <ErrorText errors={state.errors?.cargoDescription} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field name="commodity" label="Commodity" defaultValue={request?.commodity} />
        <Field name="hsCode" label="HS code" defaultValue={request?.hsCode} />
        <Field
          name="packageType"
          label="Package type"
          defaultValue={request?.packageType}
        />
        <Field
          name="packageCount"
          label="Package count"
          type="number"
          defaultValue={request?.packageCount}
        />
        <Field
          name="grossWeight"
          label="Gross weight"
          type="number"
          step="0.001"
          defaultValue={request?.grossWeight}
        />
        <Field
          name="chargeableWeight"
          label="Chargeable weight"
          type="number"
          step="0.001"
          defaultValue={request?.chargeableWeight}
        />
        <Field name="netWeight" label="Net weight" type="number" step="0.001" defaultValue={request?.netWeight} />
        <Field
          name="cbm"
          label="CBM"
          type="number"
          step="0.001"
          defaultValue={request?.cbm}
        />
        <Select
          name="incoterm"
          label="Incoterm"
          defaultValue={value(request?.incoterm)}
          options={["FOB", "CIF", "CNF", "EXW", "DDP", "DAP", "FCA", "OTHER"]}
          optional
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field name="containerRequirement" label="Container requirement" defaultValue={request?.containerRequirement} />
        <Field
          name="requestedEtd"
          label="Requested ETD"
          type="date"
          value={requestedEtd}
          onChange={handleRequestedEtdChange}
        />
        <Field
          name="requestedEta"
          label="Requested ETA"
          type="date"
          value={requestedEta}
          onChange={handleRequestedEtaChange}
        />
        <div className="space-y-2"><Label>Special cargo</Label><div className="space-y-2 rounded-md border p-3 text-sm"><label className="flex gap-2"><input type="checkbox" name="isDangerousGoods" defaultChecked={Boolean(request?.isDangerousGoods)}/>Dangerous goods</label><label className="flex gap-2"><input type="checkbox" name="isReefer" defaultChecked={Boolean(request?.isReefer)}/>Reefer</label><label className="flex gap-2"><input type="checkbox" name="isFragile" defaultChecked={Boolean(request?.isFragile)}/>Fragile</label></div></div>
      </div>
      <div className="space-y-2"><Label htmlFor="specialHandlingNote">Special handling note</Label><textarea id="specialHandlingNote" name="specialHandlingNote" defaultValue={value(request?.specialHandlingNote)} className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"/></div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Field
          name="customerReference"
          label="Customer reference"
          defaultValue={request?.customerReference}
        />
        <Field
          name="readyDate"
          label="Ready date"
          type="date"
          defaultValue={dateValue(request?.readyDate)}
        />
        <Field
          name="expectedShipmentDate"
          label="Expected shipment date"
          type="date"
          value={expectedShipmentDate}
          onChange={(e) => setExpectedShipmentDate(e.target.value)}
        />
        <Field
          name="expectedDeliveryDate"
          label="Expected delivery date"
          type="date"
          value={expectedDeliveryDate}
          onChange={(e) => setExpectedDeliveryDate(e.target.value)}
        />
      </div>

      <div className="border-t border-slate-200 pt-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Parties Information</h3>
        
        {/* Shipper Section */}
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            name="shipperName"
            label="Shipper Name"
            defaultValue={request?.shipperName}
            errors={state.errors?.shipperName}
          />
          <TextAreaField
            name="shipperAddress"
            label="Shipper Address"
            defaultValue={request?.shipperAddress}
            errors={state.errors?.shipperAddress}
          />
        </div>

        {/* Consignee Section */}
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            name="consigneeName"
            label="Consignee Name"
            defaultValue={request?.consigneeName}
            errors={state.errors?.consigneeName}
          />
          <TextAreaField
            name="consigneeAddress"
            label="Consignee Address"
            defaultValue={request?.consigneeAddress}
            errors={state.errors?.consigneeAddress}
          />
          <Field
            name="consigneeBin"
            label="Consignee BIN / VAT"
            defaultValue={request?.consigneeBin}
            errors={state.errors?.consigneeBin}
          />
        </div>

        {/* Notify Party Section */}
        <div className="grid gap-4 md:grid-cols-3">
          <Field
            name="notifyPartyName"
            label="Notify Party Name"
            defaultValue={request?.notifyPartyName}
            errors={state.errors?.notifyPartyName}
          />
          <TextAreaField
            name="notifyPartyAddress"
            label="Notify Party Address"
            defaultValue={request?.notifyPartyAddress}
            errors={state.errors?.notifyPartyAddress}
          />
          <Field
            name="notifyPartyBin"
            label="Notify Party BIN"
            defaultValue={request?.notifyPartyBin}
            errors={state.errors?.notifyPartyBin}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="customerNotes">Customer notes</Label>
        <textarea
          id="customerNotes"
          name="customerNotes"
          defaultValue={value(request?.customerNotes)}
          className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        />
      </div>
      {internal ? (
        <div className="space-y-2">
          <Label htmlFor="internalNotes">Internal notes</Label>
          <textarea
            id="internalNotes"
            name="internalNotes"
            defaultValue={value(request?.internalNotes)}
            className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </div>
      ) : (
        <input type="hidden" name="internalNotes" value="" />
      )}

      <Button type="submit" disabled={pending}>
        {request ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {request ? "Update request" : "Submit shipment request"}
      </Button>
    </form>
  );
}

export function RequestStatusForm({
  action,
  shipmentRequestId,
  internalNotes,
}: {
  action: FormAction;
  shipmentRequestId: string;
  internalNotes?: string | null;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <Alert state={state} />
      <input type="hidden" name="shipmentRequestId" value={shipmentRequestId} />
      <Label htmlFor="requestReviewStatus">Request status</Label>
      <select
        id="requestReviewStatus"
        name="status"
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
      >
        <option value="UNDER_REVIEW">Under review</option>
        <option value="QUOTED">Quoted</option>
        <option value="CANCELLED">Cancelled</option>
      </select>
      <Label htmlFor="requestInternalNotes">Internal notes</Label>
      <textarea
        id="requestInternalNotes"
        name="internalNotes"
        defaultValue={internalNotes ?? ""}
        className="min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm"
      />
      <Button type="submit" size="sm">
        <Save className="h-4 w-4" />
        Update status
      </Button>
    </form>
  );
}

export function SimpleActionForm({
  action,
  fields,
  label,
}: {
  action: FormAction;
  fields: Record<string, string>;
  label: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(fields).map(([name, fieldValue]) => (
        <input key={name} type="hidden" name={name} value={fieldValue} />
      ))}
      <Button type="submit" size="sm">
        {label}
      </Button>
      <Alert state={state} />
    </form>
  );
}

export function PortalQuotationResponseForm({
  action,
  shipmentRequestId,
  quotationId,
}: {
  action: FormAction;
  shipmentRequestId: string;
  quotationId: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <Alert state={state} />
      <input type="hidden" name="shipmentRequestId" value={shipmentRequestId} />
      <input type="hidden" name="quotationId" value={quotationId} />
      <Label htmlFor="portalQuotationResponseMessage">Response reason / revision details</Label>
      <textarea
        id="portalQuotationResponseMessage"
        name="message"
        className="min-h-20 w-full rounded-md border border-slate-200 p-3 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" name="action" value="ACCEPT" size="sm">
          <Check className="h-4 w-4" />
          Accept
        </Button>
        <Button type="submit" name="action" value="REVISION" size="sm" variant="outline">
          <FilePenLine className="h-4 w-4" />
          Request revision
        </Button>
        <Button type="submit" name="action" value="REJECT" size="sm" variant="destructive">
          <X className="h-4 w-4" />
          Reject
        </Button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  step,
  required,
  errors,
  value: controlledValue,
  onChange,
}: {
  name: string;
  label: string;
  defaultValue?: unknown;
  type?: string;
  step?: string;
  required?: boolean;
  errors?: string[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        min={type === "number" ? "0" : undefined}
        {...(controlledValue !== undefined
          ? { value: controlledValue, onChange }
          : { defaultValue: value(defaultValue) })}
        required={required}
      />
      <ErrorText errors={errors} />
    </div>
  );
}

function Select({
  name,
  label,
  defaultValue,
  options,
  optional,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: string[];
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
      >
        {optional ? <option value="">Not set</option> : null}
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  name,
  label,
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  defaultValue?: unknown;
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <textarea
        id={name}
        name={name}
        defaultValue={value(defaultValue)}
        className="min-h-16 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
      />
      <ErrorText errors={errors} />
    </div>
  );
}
