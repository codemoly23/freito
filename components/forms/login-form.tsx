"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Key, Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validators/auth";

export function LoginForm({
  loginScope = "COMPANY",
  defaultCallbackUrl = "/dashboard",
}: {
  loginScope?: "PLATFORM" | "COMPANY" | "CLIENT";
  defaultCallbackUrl?: string;
}) {
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: LoginInput) {
    setAuthError(null);
    const callbackUrl = searchParams.get("callbackUrl") ?? defaultCallbackUrl;
    const safeCallbackUrl = callbackUrl.startsWith("/") ? callbackUrl : defaultCallbackUrl;

    const scopeCheck = await fetch("/api/auth/login-scope-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: values.email,
        password: values.password,
        loginScope,
      }),
    });
    const scopeResult = (await scopeCheck.json().catch(() => null)) as
      | { ok?: boolean; code?: string }
      | null;

    if (!scopeCheck.ok || !scopeResult?.ok) {
      if (scopeResult?.code === "WRONG_LOGIN_PORTAL") {
        setAuthError("This login portal is not available for your account type.");
        return;
      }
      if (scopeResult?.code === "DATABASE_UNAVAILABLE") {
        setAuthError(
          "Database is unavailable. Check MySQL, DATABASE_URL, migration, and seed.",
        );
        return;
      }

      setAuthError("Invalid email or password.");
      return;
    }

    const result = await signIn("credentials", {
      email: values.email,
      password: values.password,
      loginScope,
      redirect: false,
      callbackUrl: safeCallbackUrl,
    });

    if (result?.error) {
      if (result.error === "DATABASE_UNAVAILABLE") {
        setAuthError(
          "Database is unavailable. Check MySQL, DATABASE_URL, migration, and seed.",
        );
        return;
      }
      if (result.error === "WRONG_LOGIN_PORTAL") {
        setAuthError("This login portal is not available for your account type.");
        return;
      }

      setAuthError("Invalid email or password.");
      return;
    }

    window.location.assign(safeCallbackUrl);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="admin@freightfast-demo.codemoly.io"
          {...form.register("email")}
        />
        {form.formState.errors.email ? (
          <p className="text-sm text-red-600">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            className="pr-11"
            {...form.register("password")}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
            onClick={() => setShowPassword((current) => !current)}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {form.formState.errors.password ? (
          <p className="text-sm text-red-600">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      {authError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {authError}
        </div>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={!hydrated || form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Sign in
      </Button>

      {hydrated && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Key className="h-3.5 w-3.5 text-slate-400" />
            <span>Demo Access Profiles</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-3">
            Click any profile below to automatically populate the login fields.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {loginScope === "PLATFORM" && [
              { label: "Platform Owner", email: "platform@freightcontrol.com", password: "Platform@2026" }
            ].map((cred) => (
              <button
                key={cred.email}
                type="button"
                onClick={() => {
                  form.setValue("email", cred.email);
                  form.setValue("password", cred.password);
                  form.clearErrors();
                  setAuthError(null);
                }}
                className="col-span-2 flex flex-col items-start rounded-md border border-slate-200 bg-white p-2.5 text-left text-xs transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400 group cursor-pointer"
              >
                <span className="font-semibold text-slate-700 group-hover:text-slate-900 flex items-center justify-between w-full">
                  {cred.label}
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded group-hover:bg-slate-200 transition-colors">
                    Autofill
                  </span>
                </span>
                <span className="text-slate-400 truncate w-full mt-0.5">{cred.email}</span>
              </button>
            ))}

            {loginScope === "CLIENT" && [
              { label: "Client Portal User", email: "client@example.com", password: "Admin123" }
            ].map((cred) => (
              <button
                key={cred.email}
                type="button"
                onClick={() => {
                  form.setValue("email", cred.email);
                  form.setValue("password", cred.password);
                  form.clearErrors();
                  setAuthError(null);
                }}
                className="col-span-2 flex flex-col items-start rounded-md border border-slate-200 bg-white p-2.5 text-left text-xs transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400 group cursor-pointer"
              >
                <span className="font-semibold text-slate-700 group-hover:text-slate-900 flex items-center justify-between w-full">
                  {cred.label}
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded group-hover:bg-slate-200 transition-colors">
                    Autofill
                  </span>
                </span>
                <span className="text-slate-400 truncate w-full mt-0.5">{cred.email}</span>
              </button>
            ))}

            {loginScope === "COMPANY" && [
              { label: "Company Admin", email: "admin@freightfast-demo.codemoly.io", password: "FreightFast@2026" },
              { label: "Operations Manager", email: "operations@freightcontrol.com", password: "Staff@2026" },
              { label: "Documentation Officer", email: "documentation@freightcontrol.com", password: "Staff@2026" },
              { label: "Accounts Officer", email: "accounts@freightcontrol.com", password: "Staff@2026" },
              { label: "Sales Executive", email: "sales@freightcontrol.com", password: "Staff@2026" }
            ].map((cred) => (
              <button
                key={cred.email}
                type="button"
                onClick={() => {
                  form.setValue("email", cred.email);
                  form.setValue("password", cred.password);
                  form.clearErrors();
                  setAuthError(null);
                }}
                className="flex flex-col items-start rounded-md border border-slate-200 bg-white p-2.5 text-left text-xs transition-all duration-200 hover:border-slate-400 hover:bg-slate-50 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-slate-400 group cursor-pointer"
              >
                <span className="font-semibold text-slate-700 group-hover:text-slate-900 flex items-center justify-between w-full gap-1">
                  <span className="truncate">{cred.label}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded group-hover:bg-slate-200 transition-colors shrink-0">
                    Autofill
                  </span>
                </span>
                <span className="text-slate-400 truncate w-full mt-0.5">{cred.email}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
