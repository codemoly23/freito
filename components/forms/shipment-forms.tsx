"use client";

import { useActionState, useRef, useState } from "react";
import { CalendarClock, PackagePlus, Save, Trash2 } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
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

function toDateValue(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function dateField(value: unknown) {
  if (value instanceof Date || typeof value === "string" || value == null) {
    return toDateValue(value);
  }

  return "";
}

function toValue(value: unknown) {
  return value == null ? "" : String(value);
}

function NamedInput({
  name,
  label,
  ...props
}: React.ComponentProps<typeof Input> & { name: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

export function ShipmentForm({
  action,
  shipment,
  companyId,
  isSuperAdmin,
  companies,
  customers,
  users,
  branches = [],
  defaultBranchId = null,
  sourceRecords = [],
}: {
  action: FormAction;
  companyId: string;
  isSuperAdmin: boolean;
  shipment?: Record<string, unknown> | null;
  companies: { id: string; name: string }[];
  customers: { id: string; name: string }[];
  users: { id: string; name: string; email: string }[];
  branches?: { id: string; name: string }[];
  defaultBranchId?: string | null;
  sourceRecords?: Array<{
    value: string;
    label: string;
    data: Record<string, string | number | null>;
  }>;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [serviceScope, setServiceScope] = useState(
    toValue(shipment?.serviceScope) || "PORT_TO_PORT",
  );
  const needsPickup =
    serviceScope === "DOOR_TO_PORT" || serviceScope === "DOOR_TO_DOOR";
  const needsDelivery =
    serviceScope === "PORT_TO_DOOR" || serviceScope === "DOOR_TO_DOOR";

  function fillFromSource(sourceValue: string) {
    const source = sourceRecords.find((item) => item.value === sourceValue);
    if (!source || !formRef.current) return;
    for (const [name, rawValue] of Object.entries(source.data)) {
      const field = formRef.current.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        field.value = rawValue == null ? "" : String(rawValue);
      }
    }
    if (source.data.serviceScope) setServiceScope(String(source.data.serviceScope));
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={toValue(shipment?.id)} />
      {!shipment && sourceRecords.length ? (
        <div className="space-y-2 rounded-md border border-cyan-200 bg-cyan-50 p-4">
          <Label htmlFor="sourceTrackingReference">Source tracking number</Label>
          <select
            id="sourceTrackingReference"
            name="sourceTrackingReference"
            defaultValue=""
            onChange={(event) => fillFromSource(event.target.value)}
            className="h-10 w-full rounded-md border border-cyan-300 bg-white px-3 text-sm"
          >
            <option value="">Select request or quotation number to auto-fill</option>
            {sourceRecords.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
          </select>
          <p className="text-xs text-cyan-800">Customer, route, cargo, mode, package, weight and CBM will be copied from the selected record.</p>
        </div>
      ) : null}
      {isSuperAdmin ? (
        <div className="space-y-2">
          <Label htmlFor="companyId">Company</Label>
          <select
            id="companyId"
            name="companyId"
            defaultValue={companyId}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="companyId" value={companyId} />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="customerId">Customer</Label>
          <select
            id="customerId"
            name="customerId"
            defaultValue={toValue(shipment?.customerId)}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            required
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.customerId} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="assignedToId">Assigned employee</Label>
          <select
            id="assignedToId"
            name="assignedToId"
            defaultValue={toValue(shipment?.assignedToId)}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            required
          >
            <option value="">Select employee</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
          <FieldError errors={state.errors?.assignedToId} />
        </div>
        {!shipment && branches.length > 1 ? (
          <div className="space-y-2">
            <Label htmlFor="branchId">Branch</Label>
            <select
              id="branchId"
              name="branchId"
              defaultValue={defaultBranchId ?? ""}
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <FieldError errors={state.errors?.branchId} />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="shipmentType">Shipment type</Label>
          <select
            id="shipmentType"
            name="shipmentType"
            defaultValue={toValue(shipment?.shipmentType) || "EXPORT"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="EXPORT">Export</option>
            <option value="IMPORT">Import</option>
          </select>
          <FieldError errors={state.errors?.shipmentType} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serviceScope">Service scope</Label>
          <select
            id="serviceScope"
            name="serviceScope"
            value={serviceScope}
            onChange={(event) => setServiceScope(event.target.value)}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            required
          >
            <option value="PORT_TO_PORT">Port to Port</option>
            <option value="DOOR_TO_PORT">Door to Port</option>
            <option value="PORT_TO_DOOR">Port to Door</option>
            <option value="DOOR_TO_DOOR">Door to Door</option>
          </select>
          <FieldError errors={state.errors?.serviceScope} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transportMode">Transport mode</Label>
          <select
            id="transportMode"
            name="transportMode"
            defaultValue={toValue(shipment?.transportMode) || "SEA"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="SEA">Sea</option>
            <option value="AIR">Air</option>
            <option value="LAND">Land</option>
          </select>
          <FieldError errors={state.errors?.transportMode} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="loadType">Load type</Label>
          <select
            id="loadType"
            name="loadType"
            defaultValue={toValue(shipment?.loadType) || "FCL"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="FCL">FCL</option>
            <option value="LCL">LCL</option>
            <option value="AIR_CARGO">Air cargo</option>
            <option value="TRUCK">Truck</option>
          </select>
          <FieldError errors={state.errors?.loadType} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tradeTerm">Trade term</Label>
          <select
            id="tradeTerm"
            name="tradeTerm"
            defaultValue={toValue(shipment?.tradeTerm)}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="">Not set</option>
            {["FOB", "CIF", "CNF", "EXW", "DDP", "DAP", "FCA", "OTHER"].map((term) => (
              <option key={term} value={term}>{term}</option>
            ))}
          </select>
          <FieldError errors={state.errors?.tradeTerm} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="originCountry">Origin country</Label>
          <Input id="originCountry" name="originCountry" defaultValue={toValue(shipment?.originCountry)} required />
          <FieldError errors={state.errors?.originCountry} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="destinationCountry">Destination country</Label>
          <Input id="destinationCountry" name="destinationCountry" defaultValue={toValue(shipment?.destinationCountry)} required />
          <FieldError errors={state.errors?.destinationCountry} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pickupAddress">
            Pickup address {needsPickup ? "(required)" : "(optional)"}
          </Label>
          <textarea
            id="pickupAddress"
            name="pickupAddress"
            defaultValue={toValue(shipment?.pickupAddress)}
            required={needsPickup}
            className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <FieldError errors={state.errors?.pickupAddress} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deliveryAddress">
            Delivery address {needsDelivery ? "(required)" : "(optional)"}
          </Label>
          <textarea
            id="deliveryAddress"
            name="deliveryAddress"
            defaultValue={toValue(shipment?.deliveryAddress)}
            required={needsDelivery}
            className="min-h-20 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <FieldError errors={state.errors?.deliveryAddress} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NamedInput name="originPort" label="Origin port" defaultValue={toValue(shipment?.originPort)} />
        <NamedInput name="destinationPort" label="Destination port" defaultValue={toValue(shipment?.destinationPort)} />
        <NamedInput name="placeOfReceipt" label="Place of receipt" defaultValue={toValue(shipment?.placeOfReceipt)} />
        <NamedInput name="placeOfDelivery" label="Place of delivery" defaultValue={toValue(shipment?.placeOfDelivery)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <NamedInput name="shipperName" label="Shipper name" defaultValue={toValue(shipment?.shipperName)} />
        <NamedInput name="consigneeName" label="Consignee name" defaultValue={toValue(shipment?.consigneeName)} />
        <NamedInput name="notifyParty" label="Notify party" defaultValue={toValue(shipment?.notifyParty)} />
        <NamedInput name="carrierName" label="Carrier name" defaultValue={toValue(shipment?.carrierName)} />
        <NamedInput name="shippingLineOrAirline" label="Shipping line / airline" defaultValue={toValue(shipment?.shippingLineOrAirline)} />
        <NamedInput name="bookingNo" label="Booking number" defaultValue={toValue(shipment?.bookingNo)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NamedInput name="vesselName" label="Vessel name" defaultValue={toValue(shipment?.vesselName)} />
        <NamedInput name="voyageNo" label="Voyage number" defaultValue={toValue(shipment?.voyageNo)} />
        <NamedInput name="flightNo" label="Flight number" defaultValue={toValue(shipment?.flightNo)} />
        <NamedInput name="mblNo" label="MBL number" defaultValue={toValue(shipment?.mblNo)} />
        <NamedInput name="hblNo" label="HBL number" defaultValue={toValue(shipment?.hblNo)} />
        <NamedInput name="mawbNo" label="MAWB number" defaultValue={toValue(shipment?.mawbNo)} />
        <NamedInput name="hawbNo" label="HAWB number" defaultValue={toValue(shipment?.hawbNo)} />
        <NamedInput name="hsCode" label="HS code" defaultValue={toValue(shipment?.hsCode)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["blOrAwbDate", "BL / AWB date"],
          ["etd", "ETD"],
          ["eta", "ETA"],
          ["actualDeparture", "Actual departure"],
          ["actualArrival", "Actual arrival"],
        ].map(([name, label]) => (
          <div key={name} className="space-y-2">
            <Label htmlFor={name}>{label}</Label>
            <Input id={name} name={name} type="date" defaultValue={dateField(shipment?.[name])} />
            <FieldError errors={state.errors?.[name]} />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label htmlFor="cargoDescription">Cargo description</Label>
        <textarea
          id="cargoDescription"
          name="cargoDescription"
          defaultValue={toValue(shipment?.cargoDescription)}
          required
          className="min-h-24 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
        />
        <FieldError errors={state.errors?.cargoDescription} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-2">
          <Label htmlFor="packageCount">Package count</Label>
          <Input id="packageCount" name="packageCount" type="number" min="0" defaultValue={toValue(shipment?.packageCount)} />
          <FieldError errors={state.errors?.packageCount} />
        </div>
        <NamedInput name="packageType" label="Package type" defaultValue={toValue(shipment?.packageType)} />
        <div className="space-y-2">
          <Label htmlFor="grossWeight">Gross weight</Label>
          <Input id="grossWeight" name="grossWeight" type="number" min="0" step="0.001" defaultValue={toValue(shipment?.grossWeight)} />
          <FieldError errors={state.errors?.grossWeight} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="netWeight">Net weight</Label>
          <Input id="netWeight" name="netWeight" type="number" min="0" step="0.001" defaultValue={toValue(shipment?.netWeight)} />
          <FieldError errors={state.errors?.netWeight} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="chargeableWeight">Chargeable weight</Label>
          <Input id="chargeableWeight" name="chargeableWeight" type="number" min="0" step="0.001" defaultValue={toValue(shipment?.chargeableWeight)} />
          <FieldError errors={state.errors?.chargeableWeight} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cbm">CBM</Label>
          <Input id="cbm" name="cbm" type="number" min="0" step="0.001" defaultValue={toValue(shipment?.cbm)} />
          <FieldError errors={state.errors?.cbm} />
        </div>
      </div>

      <Button type="submit">
        <Save className="h-4 w-4" />
        {shipment ? "Update shipment" : "Create shipment"}
      </Button>
    </form>
  );
}

export function ContainerForm({
  action,
  shipmentJobId,
  container,
}: {
  action: FormAction;
  shipmentJobId: string;
  container?: Record<string, unknown> | null;
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="id" defaultValue={toValue(container?.id)} />
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="containerNo">Container number</Label>
          <Input id="containerNo" name="containerNo" defaultValue={toValue(container?.containerNo)} required />
          <FieldError errors={state.errors?.containerNo} />
        </div>
        <NamedInput name="sealNo" label="Seal number" defaultValue={toValue(container?.sealNo)} />
        <NamedInput name="containerType" label="Container type / size" defaultValue={toValue(container?.containerType)} />
        <div className="space-y-2"><Label htmlFor="demurrageRiskStatus">Demurrage risk status</Label><select
            id="demurrageRiskStatus"
            name="demurrageRiskStatus"
            defaultValue={toValue(container?.demurrageRiskStatus) || "NOT_APPLICABLE"}
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
          >
            <option value="NOT_APPLICABLE">Not applicable</option>
            <option value="SAFE">Safe</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <NamedInput name="packageCount" label="Package count" type="number" min="0" defaultValue={toValue(container?.packageCount)} />
        <NamedInput name="grossWeight" label="Gross weight" type="number" min="0" step="0.001" defaultValue={toValue(container?.grossWeight)} />
        <NamedInput name="cbm" label="CBM" type="number" min="0" step="0.001" defaultValue={toValue(container?.cbm)} />
        <NamedInput name="gateInDate" label="Gate-in date" type="date" defaultValue={dateField(container?.gateInDate)} />
        <NamedInput name="gateOutDate" label="Gate-out date" type="date" defaultValue={dateField(container?.gateOutDate)} />
        <NamedInput name="freeTimeLastDate" label="Free-time last date" type="date" defaultValue={dateField(container?.freeTimeLastDate)} />
      </div>
      <Button type="submit" variant="secondary">
        <PackagePlus className="h-4 w-4" />
        {container ? "Update container" : "Add container"}
      </Button>
    </form>
  );
}

export function ShipmentStatusForm({
  action,
  shipmentJobId,
  shipmentType,
  statuses,
}: {
  action: FormAction;
  shipmentJobId: string;
  shipmentType: string;
  statuses: readonly string[];
}) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <FormAlert state={state} />
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="shipmentType" value={shipmentType} />
      <div className="grid gap-3 md:grid-cols-[260px_1fr_auto]">
        <div className="space-y-2">
          <Label htmlFor="shipmentStatus">Shipment status</Label>
          <select
            id="shipmentStatus"
            name="status"
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
            required
          >
            {statuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <FieldError errors={state.errors?.status} />
        </div>
        <NamedInput name="remarks" label="Status remarks" />
        <Button type="submit">
          <CalendarClock className="h-4 w-4" />
          Add status
        </Button>
      </div>
    </form>
  );
}

export function ConfirmDeleteButton({
  label = "Delete",
  message = "Are you sure?",
}: {
  label?: string;
  message?: string;
}) {
  return (
    <Button
      type="submit"
      size="sm"
      variant="destructive"
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <Trash2 className="h-4 w-4" />
      {label}
    </Button>
  );
}
