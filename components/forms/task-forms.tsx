"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { taskPriorities, taskStatuses } from "@/lib/validators/tasks";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
type Option = { id: string; label: string };

function Field({ name, label, options, value }: { name: string; label: string; options: Option[]; value?: string | null }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" defaultValue={value ?? ""} id={name} name={name}><option value="">Not linked</option>{options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>;
}

export function TaskForm({
  action,
  task,
  users,
  customers,
  vendors,
  shipments,
  quotations,
  invoices,
  requests,
  defaults,
  canAssign,
}: {
  action: FormAction;
  task?: Record<string, unknown> | null;
  users: Option[];
  customers: Option[];
  vendors: Option[];
  shipments: Option[];
  quotations: Option[];
  invoices: Option[];
  requests: Option[];
  defaults?: Record<string, string | undefined>;
  canAssign: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const value = (key: string) => String(task?.[key] ?? defaults?.[key] ?? "");
  return <form action={formAction} className="space-y-5">
    {state.message ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.message}</p> : null}
    <input name="id" type="hidden" value={value("id")} />
    <input name="returnTo" type="hidden" value={value("returnTo")} />
    <div className="space-y-2"><Label htmlFor="title">Title</Label><Input id="title" name="title" defaultValue={value("title")} required /></div>
    <div className="space-y-2"><Label htmlFor="description">Description</Label><textarea className="min-h-28 w-full rounded-md border border-slate-200 px-3 py-2 text-sm" defaultValue={value("description")} id="description" name="description" /></div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2"><Label htmlFor="status">Status</Label><select className="h-10 w-full rounded-md border px-3 text-sm" defaultValue={value("status") || "TODO"} id="status" name="status">{taskStatuses.map((status) => <option key={status}>{status}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="priority">Priority</Label><select className="h-10 w-full rounded-md border px-3 text-sm" defaultValue={value("priority") || "MEDIUM"} id="priority" name="priority">{taskPriorities.map((priority) => <option key={priority}>{priority}</option>)}</select></div>
      <div className="space-y-2"><Label htmlFor="dueDate">Due date</Label><Input defaultValue={value("dueDate")} id="dueDate" name="dueDate" type="date" /></div>
      {canAssign ? <Field label="Assigned user" name="assignedUserId" options={users} value={value("assignedUserId")} /> : <input name="assignedUserId" type="hidden" value={value("assignedUserId")} />}
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Customer" name="customerId" options={customers} value={value("customerId")} />
      <Field label="Vendor" name="vendorId" options={vendors} value={value("vendorId")} />
      <Field label="Shipment" name="shipmentJobId" options={shipments} value={value("shipmentJobId")} />
      <Field label="Quotation" name="quotationId" options={quotations} value={value("quotationId")} />
      <Field label="Invoice" name="invoiceId" options={invoices} value={value("invoiceId")} />
      <Field label="Shipment request" name="shipmentRequestId" options={requests} value={value("shipmentRequestId")} />
    </div>
    <Button type="submit">{task ? "Save task" : "Create task"}</Button>
  </form>;
}

export function TaskCommentForm({ action, taskId }: { action: FormAction; taskId: string }) {
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className="space-y-3"><input name="taskId" type="hidden" value={taskId} /><div className="space-y-2"><Label htmlFor="taskCommentBody">Internal task comment</Label><textarea id="taskCommentBody" className="min-h-24 w-full rounded-md border px-3 py-2 text-sm" name="body" required /></div><Button size="sm" type="submit">Add comment</Button>{state.message ? <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>{state.message}</p> : null}</form>;
}
