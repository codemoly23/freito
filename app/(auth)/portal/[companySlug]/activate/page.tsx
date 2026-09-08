import { hashPortalActivationToken } from "@/lib/client-portal/activation";
import { prisma } from "@/lib/db/prisma";
import { PortalActivationForm } from "@/components/forms/portal-activation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PortalActivatePage({ params, searchParams }: { params: Promise<{ companySlug: string }>; searchParams: Promise<{ token?: string }> }) {
  const { companySlug } = await params;
  const { token = "" } = await searchParams;
  const activation = token ? await prisma.customerportalactivationtoken.findFirst({
    where: {
      tokenHash: hashPortalActivationToken(token),
      usedAt: null,
      deletedAt: null,
      expiresAt: { gt: new Date() },
      company: { portalSlug: companySlug, portalEnabled: true },
    },
    select: { id: true },
  }) : null;
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Activate client portal access</CardTitle></CardHeader><CardContent>{activation ? <PortalActivationForm companySlug={companySlug} token={token} /> : <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Activation link is invalid, expired, or already used.</div>}</CardContent></Card></main>;
}
