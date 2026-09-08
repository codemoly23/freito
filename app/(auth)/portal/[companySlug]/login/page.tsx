import { redirect } from "next/navigation";
import { UserRoundCheck } from "lucide-react";
import { ClientPortalLoginForm } from "@/components/forms/client-portal-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type PageProps = { params: Promise<{ companySlug: string }> };

export default async function CompanyPortalLoginPage({ params }: PageProps) {
  const { companySlug } = await params;
  const normalizedCompanySlug = companySlug.toLowerCase();
  const user = await getCurrentUser();

  if (user?.scope === "CLIENT" && user.companySlug?.toLowerCase() === normalizedCompanySlug) {
    redirect(`/portal/${user.companySlug}`);
  }

  const company = await prisma.company.findFirst({
    where: { portalSlug: companySlug.toLowerCase(), deletedAt: null },
    select: {
      name: true,
      status: true,
      portalEnabled: true,
      portalDisplayName: true,
      subscriptionStatus: true,
      trialEndsAt: true,
      companymoduleaccess: {
        where: { moduleKey: "CLIENT_PORTAL", isEnabled: true },
        select: { id: true },
      },
    },
  });

  const subscriptionAllowed =
    company?.subscriptionStatus === "ACTIVE" ||
    (company?.subscriptionStatus === "TRIAL" &&
      (!company.trialEndsAt || company.trialEndsAt >= new Date()));
  const unavailable = !company || !company.portalEnabled || company.companymoduleaccess.length === 0;
  const companyUnavailable =
    company && (company.status !== "ACTIVE" || !subscriptionAllowed);

  return (
    <main
      className="relative flex min-h-screen items-center justify-center bg-slate-950 px-5 py-10"
      style={{
        backgroundImage: "url('/images/client-portal-login-hero.png')",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/55" />
      <Card className="relative z-10 w-full max-w-md border-white/15 bg-white/95 shadow-2xl backdrop-blur">
        <CardHeader>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
            <UserRoundCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">
            {company?.portalDisplayName ?? `${company?.name ?? "Client"} Portal`}
          </CardTitle>
          <CardDescription>Use the Client ID provided by your freight forwarder.</CardDescription>
        </CardHeader>
        <CardContent>
          {unavailable ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This client portal is not available.
            </p>
          ) : companyUnavailable ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This client portal is currently unavailable. Please contact the company.
            </p>
          ) : (
            <ClientPortalLoginForm companySlug={companySlug.toLowerCase()} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
