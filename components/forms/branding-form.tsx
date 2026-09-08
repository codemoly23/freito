"use client";

import { useActionState } from "react";
import Image from "next/image";
import type { ActionState } from "@/lib/actions/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BrandingForm({
  action,
  hasLogo,
  logoVersion,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  hasLogo: boolean;
  logoVersion?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return <form action={formAction} className="space-y-4">
    {hasLogo ? <div className="rounded-md border bg-white p-4"><Image alt="Current company logo" className="h-20 w-auto object-contain" height={80} src={`/api/company/branding/logo?v=${logoVersion ?? ""}`} unoptimized width={240} /></div> : <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">No logo uploaded. Company identity text will be used.</p>}
    <Input accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" name="logo" type="file" />
    <p className="text-xs text-slate-500">PNG, JPG, JPEG, or WebP. Maximum 2MB.</p>
    <Button type="submit">Upload logo</Button>
    {state.message ? <p className={state.ok ? "text-sm text-emerald-700" : "text-sm text-red-600"}>{state.message}</p> : null}
  </form>;
}
