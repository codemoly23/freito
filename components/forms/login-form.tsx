"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
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
    </form>
  );
}
