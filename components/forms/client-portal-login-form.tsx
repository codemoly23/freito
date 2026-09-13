"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clientPortalLoginSchema,
  type ClientPortalLoginInput,
} from "@/lib/validators/auth";

export function ClientPortalLoginForm({ companySlug }: { companySlug: string }) {
  const [authError, setAuthError] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<ClientPortalLoginInput>({
    resolver: zodResolver(clientPortalLoginSchema),
    defaultValues: { companySlug, clientCode: "", password: "" },
  });

  function onInvalidSubmit() {
    setAuthError("Invalid client ID or password.");
  }

  async function onSubmit(values: ClientPortalLoginInput) {
    setAuthError(null);
    const result = await signIn("client-portal", {
      ...values,
      redirect: false,
      callbackUrl: `/portal/${companySlug}`,
    });

    if (result?.error) {
      setAuthError("Invalid client ID or password.");
      return;
    }

    window.location.assign(`/portal/${companySlug}`);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-4">
      <input type="hidden" {...form.register("companySlug")} />
      <div className="space-y-2">
        <Label htmlFor="clientCode">Client ID</Label>
        <Input
          id="clientCode"
          autoComplete="username"
          placeholder="DFC-CL-2026-0001"
          {...form.register("clientCode")}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clientPassword">Password</Label>
        <div className="relative">
          <Input
            id="clientPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-11"
            {...form.register("password")}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {authError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {authError}
        </div>
      ) : null}
      <Button type="submit" className="w-full" disabled={!hydrated || form.formState.isSubmitting}>
        {form.formState.isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Sign in
      </Button>
    </form>
  );
}
