"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { decideApproval } from "@/lib/actions/approvals";
import type { ActionState } from "@/lib/actions/helpers";

const initialState: ActionState = {};

export function DecideForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(decideApproval, initialState);
  const [remarks, setRemarks] = useState("");

  return (
    <form action={formAction} className="flex flex-col gap-2 md:w-72">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="remarks" value={remarks} />
      <textarea
        value={remarks}
        onChange={(event) => setRemarks(event.target.value)}
        placeholder="Remarks (optional)"
        maxLength={500}
        rows={2}
        className="w-full rounded-md border border-slate-200 p-2 text-xs"
      />
      {state.message ? (
        <p className={`text-xs ${state.ok ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" name="decision" value="APPROVED" size="sm">
          Approve
        </Button>
        <Button type="submit" name="decision" value="REJECTED" size="sm" variant="destructive">
          Reject
        </Button>
      </div>
    </form>
  );
}
