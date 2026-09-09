import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
import { LoginForm } from "@/components/forms/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

function resolveLoginContext(host: string | null) {
  const normalizedHost = (host ?? "").split(":")[0].toLowerCase();
  const adminHost = process.env.ADMIN_APP_HOST?.toLowerCase() ?? "admin.freightcontrol.com";
  const companyHost = process.env.COMPANY_APP_HOST?.toLowerCase() ?? "app.freightcontrol.com";
  const portalHost = process.env.PORTAL_APP_HOST?.toLowerCase() ?? "portal.freightcontrol.com";

  if (normalizedHost === adminHost || normalizedHost.startsWith("admin.")) {
    return {
      scope: "PLATFORM" as const,
      callbackUrl: "/platform",
      title: "Platform Panel login",
      description: "Software owner access for companies, subscriptions, licenses, and module control.",
    };
  }

  if (normalizedHost === portalHost || normalizedHost.startsWith("portal.")) {
    return {
      scope: "CLIENT" as const,
      callbackUrl: "/portal",
      title: "Client Portal login",
      description: "Customer-facing shipment visibility for approved client users.",
    };
  }

  return {
    scope: "COMPANY" as const,
    callbackUrl: "/dashboard",
    title: "Sign in to FreightFast",
    description: "Manage shipment jobs, documents, tasks, billing, and operational follow-up from one secure workspace.",
    companyHost,
  };
}

export default async function LoginPage() {
  const user = await getCurrentUser();
  const requestHeaders = await headers();
  const loginContext = resolveLoginContext(requestHeaders.get("host"));

  if (user?.scope === "COMPANY") {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[0.75fr_1.25fr]">
      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="relative mb-4 h-8 w-32">
              <Image
                src="/images/freito-logo.png"
                alt="FreightFast"
                fill
                priority
                className="object-contain object-left"
              />
            </div>
            <CardTitle className="text-2xl">{loginContext.title}</CardTitle>
            <CardDescription>
              {loginContext.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense>
              <LoginForm loginScope={loginContext.scope} defaultCallbackUrl={loginContext.callbackUrl} />
            </Suspense>
          </CardContent>
        </Card>
      </section>

      <section
        aria-label="FreightFast System hero"
        className="hidden min-h-screen bg-slate-950 lg:block"
        style={{
          backgroundImage: "url('/images/login-freight-hero.png')",
          backgroundPosition: "left center",
          backgroundSize: "cover",
        }}
      >
        <span className="sr-only">
          Welcome to FreightFast System. Smarter freight forwarding, faster
          operations, full control.
        </span>
      </section>
    </main>
  );
}
