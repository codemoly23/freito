import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "@/components/forms/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

export default async function PlatformLoginPage() {
  const user = await getCurrentUser();

  if (user?.scope === "PLATFORM") {
    redirect("/platform");
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-cyan-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl">Platform Panel login</CardTitle>
            <CardDescription>
              Software owner access for companies, subscriptions, licenses, and
              module control.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm loginScope="PLATFORM" defaultCallbackUrl="/platform" />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      <section className="hidden min-h-screen bg-slate-950 px-12 py-16 text-white lg:flex lg:flex-col lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-300">FreightFast Operator Console</p>
          <h1 className="mt-8 max-w-2xl text-5xl font-semibold leading-tight">
            Control tenant access without entering company operations.
          </h1>
        </div>
        <div className="grid gap-4">
          {["Company lifecycle", "License and module access", "Platform audit readiness"].map((item) => (
            <div key={item} className="rounded-md border border-white/15 bg-white/5 p-5 text-sm text-slate-200">
              {item}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
