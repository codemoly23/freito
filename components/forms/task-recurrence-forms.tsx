"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { recurrenceFrequencies } from "@/lib/validators/task-recurrences";
import { taskPriorities } from "@/lib/validators/tasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; label: string };

function Field({ name, label, options, value }: { name: string; label: string; options: Option[]; value?: string | null }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" defaultValue={value ?? ""} id={name} name={name}>
        <option value="">Not linked</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </div>
  );
}

export function TaskRecurrenceForm({
  action,
  recurrence,
  users,
  customers,
  vendors,
  shipments,
  quotations,
  invoices,
  requests,
  canAssign,
}: {
  action: FormAction;
  recurrence?: Record<string, unknown> | null;
  users: Option[];
  customers: Option[];
  vendors: Option[];
  shipments: Option[];
  quotations: Option[];
  invoices: Option[];
  requests: Option[];
  canAssign: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const value = (key: string) => String(recurrence?.[key] ?? "");
  const detectedTimezone = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.message}</p> : null}
      <input name="id" type="hidden" value={value("id")} />

      <div className="space-y-2">
        <Label htmlFor="title">Task title</Label>
        <Input id="title" name="title" defaultValue={value("title")} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea className="min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" defaultValue={value("description")} id="description" name="description" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select className="h-10 w-full rounded-md border px-3 text-sm" defaultValue={value("priority") || "MEDIUM"} id="priority" name="priority">
            {taskPriorities.map((priority) => <option key={priority}>{priority}</option>)}
          </select>
        </div>
        {canAssign ? <Field label="Assigned user" name="assignedUserId" options={users} value={value("assignedUserId")} /> : <input name="assignedUserId" type="hidden" value={value("assignedUserId")} />}
        <Field label="Customer" name="customerId" options={customers} value={value("customerId")} />
        <Field label="Vendor" name="vendorId" options={vendors} value={value("vendorId")} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Field label="Shipment" name="shipmentJobId" options={shipments} value={value("shipmentJobId")} />
        <Field label="Quotation" name="quotationId" options={quotations} value={value("quotationId")} />
        <Field label="Invoice" name="invoiceId" options={invoices} value={value("invoiceId")} />
      </div>
      <Field label="Shipment request" name="shipmentRequestId" options={requests} value={value("shipmentRequestId")} />

      <div className="rounded-md border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-950">Repeat schedule</h3>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Repeats</Label>
            <select className="h-10 w-full rounded-md border px-3 text-sm" defaultValue={value("frequency") || "DAILY"} id="frequency" name="frequency">
              {recurrenceFrequencies.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="interval">Every N (day/week/month)</Label>
            <Input id="interval" name="interval" type="number" min={1} max={365} defaultValue={value("interval") || "1"} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone (IANA)</Label>
            <Input id="timezone" name="timezone" defaultValue={value("timezone") || detectedTimezone} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dueInDays">Task due N days after occurrence</Label>
            <Input id="dueInDays" name="dueInDays" type="number" min={0} max={365} defaultValue={value("dueInDays") || "0"} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Start date</Label>
            <Input id="startDate" name="startDate" type="date" defaultValue={value("startDate")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate">End date (optional)</Label>
            <Input id="endDate" name="endDate" type="date" defaultValue={value("endDate")} />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Weekly repeats fall on the same weekday as the start date. Monthly repeats fall on the same day of month, clamped to the last day of shorter months.
        </p>
      </div>

      <Button type="submit">{recurrence ? "Save recurrence" : "Create recurrence"}</Button>
    </form>
  );
}
