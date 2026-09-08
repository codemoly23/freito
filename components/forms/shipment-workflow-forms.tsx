"use client";

import { useActionState, useState } from "react";
import { Save, UserRoundCog, WandSparkles } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (
  state: ActionState,
  formData: FormData,
) => Promise<ActionState>;

const initialState: ActionState = {};

function Alert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>
      {state.message}
    </p>
  );
}

function dateValue(value?: Date | string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export function WorkflowGenerateForm({
  action,
  shipmentJobId,
  regenerate,
}: {
  action: FormAction;
  shipmentJobId: string;
  regenerate: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <Button type="submit" variant="outline" disabled={pending}>
        <WandSparkles className="h-4 w-4" />
        {regenerate ? "Regenerate Workflow" : "Generate Workflow"}
      </Button>
      <Alert state={state} />
    </form>
  );
}

export function WorkflowStepUpdateForm({
  action,
  shipmentJobId,
  step,
}: {
  action: FormAction;
  shipmentJobId: string;
  step: {
    id: string;
    status: string;
    dueDate?: Date | string | null;
    notes?: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="workflowStepId" value={step.id} />
      <div className="grid gap-2 md:grid-cols-[180px_150px_1fr_auto]">
        <div className="space-y-1"><Label htmlFor={`workflowStatus-${step.id}`}>Step status</Label><select
          id={`workflowStatus-${step.id}`}
          name="status"
          defaultValue={step.status}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
        >
          <option value="NOT_STARTED">Not started</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="WAITING">Waiting</option>
          <option value="COMPLETED">Completed</option>
          <option value="BLOCKED">Blocked</option>
          <option value="CANCELLED">Cancelled</option>
        </select></div>
        <div className="space-y-1"><Label htmlFor={`workflowDueDate-${step.id}`}>Due date</Label><Input
          id={`workflowDueDate-${step.id}`}
          name="dueDate"
          type="date"
          defaultValue={dateValue(step.dueDate)}
          className="h-9 text-xs"
        /></div>
        <div className="space-y-1"><Label htmlFor={`workflowNotes-${step.id}`}>Internal notes</Label><Input
          id={`workflowNotes-${step.id}`}
          name="notes"
          defaultValue={step.notes ?? ""}
          className="h-9 text-xs"
        /></div>
        <Button type="submit" size="sm" disabled={pending}>
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
      </div>
      <Alert state={state} />
    </form>
  );
}

export function WorkflowAssignmentForm({
  action,
  shipmentJobId,
  step,
  users,
  vendors,
}: {
  action: FormAction;
  shipmentJobId: string;
  step: {
    id: string;
    handlerType?: string | null;
    assignedUserId?: string | null;
    vendorId?: string | null;
  };
  users: { id: string; name: string; email: string }[];
  vendors: { id: string; name: string; type: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [handlerType, setHandlerType] = useState(step.handlerType ?? "");
  const isInternal = handlerType === "INTERNAL_EMPLOYEE";

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="workflowStepId" value={step.id} />
      <div className="grid gap-2 md:grid-cols-[190px_1fr_auto]">
        <select
          name="handlerType"
          value={handlerType}
          onChange={(event) => setHandlerType(event.target.value)}
          className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
        >
          <option value="">Unassigned</option>
          <option value="INTERNAL_EMPLOYEE">Internal employee</option>
          <option value="EXTERNAL_AGENT">External agent</option>
          <option value="VENDOR">Vendor / partner</option>
          <option value="CF_AGENT">C&amp;F agent</option>
          <option value="TRUCK_PROVIDER">Truck provider</option>
          <option value="DESTINATION_AGENT">Destination agent</option>
          <option value="DESTINATION_AGENT">Destination agent</option>
        </select>
        {isInternal ? (
          <select
            name="assignedUserId"
            defaultValue={step.assignedUserId ?? ""}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
            required
          >
            <option value="">Select employee</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </select>
        ) : (
          <select
            name="vendorId"
            defaultValue={step.vendorId ?? ""}
            className="h-9 rounded-md border border-slate-200 bg-white px-2 text-xs"
            required={Boolean(handlerType)}
          >
            <option value="">Select vendor / agent</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name} ({vendor.type.replaceAll("_", " ")})
              </option>
            ))}
          </select>
        )}
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <UserRoundCog className="h-3.5 w-3.5" />
          Assign
        </Button>
      </div>
      <Alert state={state} />
    </form>
  );
}

export function WorkflowStageTransitionForm({
  action,
  shipmentJobId,
  stageCode,
}: {
  action: FormAction;
  shipmentJobId: string;
  stageCode: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="stageCode" value={stageCode} />
      <input type="hidden" name="status" value="COMPLETED" />
      <Button type="submit" size="sm" disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs">
        Complete Stage
      </Button>
      {state.message && (
        <p className="mt-1 text-xs text-red-600 block">{state.message}</p>
      )}
    </form>
  );
}

export function WorkflowStageOverrideForm({
  action,
  shipmentJobId,
  stageCode,
}: {
  action: FormAction;
  shipmentJobId: string;
  stageCode: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [reason, setReason] = useState("");
  return (
    <form action={formAction} className="flex flex-col gap-2 mt-2 max-w-md">
      <input type="hidden" name="shipmentJobId" value={shipmentJobId} />
      <input type="hidden" name="stageCode" value={stageCode} />
      <div className="flex gap-2">
        <Input
          placeholder="Override reason..."
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          className="h-8 text-xs shrink"
        />
        <Button type="submit" size="sm" variant="destructive" disabled={pending} className="h-8 text-xs shrink-0">
          Override
        </Button>
      </div>
      {state.message && (
        <p className={state.ok ? "text-xs text-emerald-700" : "text-xs text-red-600"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
