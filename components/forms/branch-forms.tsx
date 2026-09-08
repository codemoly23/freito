"use client";

import { useActionState } from "react";
import { Building2, Save, UserPlus } from "lucide-react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
const initialState: ActionState = {};

function Alert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return <p className={state.ok ? "rounded-md bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-md bg-red-50 p-3 text-sm text-red-800"}>{state.message}</p>;
}

export function BranchForm({ action, branch }: { action: FormAction; branch?: { id: string; name: string; code: string; email: string | null; phone: string | null; address: string | null } | null }) {
  const [state, formAction] = useActionState(action, initialState);
  return <form action={formAction} className="space-y-4">
    <Alert state={state} />
    <input type="hidden" name="id" defaultValue={branch?.id ?? ""} />
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="branch-name">Branch name</Label><Input id="branch-name" name="name" defaultValue={branch?.name ?? ""} required /></div>
      <div className="space-y-2"><Label htmlFor="branch-code">Branch code</Label><Input id="branch-code" name="code" defaultValue={branch?.code ?? ""} placeholder="DHK-HEAD" required /></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2"><Label htmlFor="branch-email">Email</Label><Input id="branch-email" name="email" type="email" defaultValue={branch?.email ?? ""} /></div>
      <div className="space-y-2"><Label htmlFor="branch-phone">Phone</Label><Input id="branch-phone" name="phone" defaultValue={branch?.phone ?? ""} /></div>
    </div>
    <div className="space-y-2"><Label htmlFor="branch-address">Address</Label><Input id="branch-address" name="address" defaultValue={branch?.address ?? ""} /></div>
    <Button type="submit" className="w-full"><Building2 className="h-4 w-4" />{branch ? "Update branch" : "Create branch"}</Button>
  </form>;
}

export function BranchMembershipForm({ action, users, branches }: { action: FormAction; users: { id: string; name: string; email: string }[]; branches: { id: string; name: string; code: string }[] }) {
  const [state, formAction] = useActionState(action, initialState);
  return <form action={formAction} className="space-y-4">
    <Alert state={state} />
    <div className="space-y-2"><Label htmlFor="member-user">Team member</Label><select id="member-user" name="userId" required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Select user</option>{users.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.email}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="member-branch">Branch</Label><select id="member-branch" name="branchId" required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="">Select branch</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></div>
    <label className="flex items-center gap-2 text-sm text-slate-700"><input name="isDefault" type="checkbox" value="true" /> Make this the user&apos;s default branch</label>
    <Button type="submit" className="w-full" variant="secondary"><UserPlus className="h-4 w-4" />Save membership</Button>
  </form>;
}
