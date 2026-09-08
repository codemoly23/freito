"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
const initialState: ActionState = {};

function Alert({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div className={state.ok ? "rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" : "rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"}>
      {state.message}
    </div>
  );
}

export function CreateClientPortalAccountForm({
  action,
  customerId,
}: {
  action: FormAction;
  customerId: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <input type="hidden" name="customerId" value={customerId} />
      <p className="text-sm text-slate-600">Creates a Client ID and a single-use 24-hour activation link. No password is generated or sent.</p>
      <Button type="submit">Send Portal Access</Button>
      {state.activationLink ? <CopyActivationLink value={state.activationLink} /> : null}
    </form>
  );
}

export function ResetClientPortalPasswordForm({
  action,
  accountId,
}: {
  action: FormAction;
  accountId: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <input type="hidden" name="id" value={accountId} />
      <p className="text-sm text-slate-600">Invalidates the existing password and prepares a fresh activation invitation.</p>
      <Button type="submit" variant="outline">Reset Portal Access</Button>
      {state.activationLink ? <CopyActivationLink value={state.activationLink} /> : null}
    </form>
  );
}

export function UpdateClientPortalAccountForm({
  action,
  account,
}: {
  action: FormAction;
  account: { id: string; email: string | null; phone: string | null };
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-4">
      <Alert state={state} />
      <input type="hidden" name="id" value={account.id} />
      <div className="space-y-2">
        <Label htmlFor="portalEmail">Contact email</Label>
        <Input id="portalEmail" name="email" type="email" defaultValue={account.email ?? ""} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="portalPhone">Contact phone</Label>
        <Input id="portalPhone" name="phone" defaultValue={account.phone ?? ""} />
      </div>
      <Button type="submit" variant="outline">Update contact</Button>
    </form>
  );
}

export function PortalInvitationForm({
  action,
  accountId,
}: {
  action: FormAction;
  accountId: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <Alert state={state} />
      <input name="id" type="hidden" value={accountId} />
      <Button type="submit">Resend Portal Access</Button>
      {state.activationLink ? <CopyActivationLink value={state.activationLink} /> : null}
    </form>
  );
}

function CopyActivationLink({ value }: { value: string }) {
  return <div className="space-y-2"><Input aria-label="Activation link" readOnly value={value} /><Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(value)}>Copy Activation Link</Button></div>;
}
