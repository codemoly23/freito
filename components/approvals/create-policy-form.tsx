"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveApprovalPolicy } from "@/lib/actions/approval-policies";
import { APPROVER_ROLE_CODES } from "@/lib/approvals/approver-roles";
import type { ActionState } from "@/lib/actions/helpers";

const ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: "Company Admin / Owner",
  OPERATIONS_MANAGER: "Operations Manager",
  DOCUMENTATION_OFFICER: "Documentation Officer",
  ACCOUNTS_OFFICER: "Accounts Officer",
  SALES_EXECUTIVE: "Sales Executive",
};

const initialState: ActionState = {};

export function CreatePolicyForm({
  documentType,
  branches,
}: {
  documentType: string;
  branches: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(saveApprovalPolicy, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-md border border-slate-200 p-4">
      <input type="hidden" name="documentType" value={documentType} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">Policy name</span>
          <Input name="name" placeholder="e.g. Large bill sign-off" required maxLength={80} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">Applies to</span>
          <select name="branchId" defaultValue="" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
            <option value="">All branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-slate-500">Threshold amount (BDT)</span>
          <Input name="thresholdAmountBDT" type="number" min="0" step="0.01" placeholder="e.g. 50000" required />
          <span className="text-[11px] text-slate-400">Amount is normalized to BDT using the document&apos;s own exchange rate before comparing.</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {[1, 2, 3, 4, 5].map((step) => (
          <div key={step} className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-slate-500">Step {step}{step === 1 ? " (required)" : " (optional)"}</span>
            <select name="approverRoleSequence" defaultValue="" className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="">{step === 1 ? "Select a role" : "-- none --"}</option>
              {APPROVER_ROLE_CODES.map((code) => (
                <option key={code} value={code}>{ROLE_LABELS[code]}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-600" : "text-red-600"}`}>{state.message}</p>
      ) : null}
      <Button type="submit" variant="secondary">Create policy</Button>
    </form>
  );
}
