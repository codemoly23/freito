"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortalActivationForm({ companySlug, token }: { companySlug: string; token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  async function submit(formData: FormData) {
    setError("");
    const response = await fetch(`/api/portal/${companySlug}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        password: String(formData.get("password") ?? ""),
        confirmPassword: String(formData.get("confirmPassword") ?? ""),
      }),
    });
    const data = await response.json();
    if (!response.ok) return setError(data.message ?? "Activation failed.");
    setMessage(data.message);
    setComplete(true);
  }
  return <form onSubmit={(event) => { event.preventDefault(); void submit(new FormData(event.currentTarget)); }} className="space-y-4">
    <div className="space-y-2"><Label htmlFor="activationPassword">New password</Label><Input id="activationPassword" name="password" type="password" required disabled={complete} /></div>
    <div className="space-y-2"><Label htmlFor="activationConfirmPassword">Confirm password</Label><Input id="activationConfirmPassword" name="confirmPassword" type="password" required disabled={complete} /></div>
    {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div> : null}
    {complete ? <Button asChild className="w-full"><Link href={`/portal/${companySlug}/login`}>Go to portal login</Link></Button> : <Button className="w-full" type="submit">Activate portal access</Button>}
  </form>;
}
