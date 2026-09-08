import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { params: Promise<{ id: string }> };

export default async function PlatformCompanyDetailPage({ params }: PageProps) {
  await requirePlatformPermission("platform:companies:view");
  const { id } = await params;

  const company = await prisma.company.findFirst({
    where: { id, deletedAt: null },
    include: {
      companysubscription: true,
      companymoduleaccess: { orderBy: { moduleKey: "asc" } },
      _count: {
        select: {
          user: true,
          customer: true,
          vendor: true,
          shipmentjob: true,
          quotation: true,
        },
      },
    },
  });

  if (!company) notFound();

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant={company.status === "ACTIVE" ? "success" : "warning"}>{company.status}</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">{company.name}</h1>
        <p className="mt-1 text-sm text-slate-600">{company.legalName ?? company.email ?? "Tenant company"}</p>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Users" value={company._count.user} />
        <Metric label="Customers" value={company._count.customer} />
        <Metric label="Shipments" value={company._count.shipmentjob} />
        <Metric label="Quotations" value={company._count.quotation} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Client portal</CardTitle>
            <CardDescription>Company-scoped portal identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            <p>Status: <span className="font-medium text-slate-950">{company.portalEnabled ? "Enabled" : "Disabled"}</span></p>
            <p>Name: <span className="font-medium text-slate-950">{company.portalDisplayName ?? "-"}</span></p>
            <p>Prefix: <span className="font-medium text-slate-950">{company.portalCodePrefix ?? "-"}</span></p>
            <p>URL: <span className="font-medium text-slate-950">{company.portalSlug ? `/portal/${company.portalSlug}/login` : "-"}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>License profile</CardTitle>
            <CardDescription>SaaS/lifetime cloud metadata only. Billing is not implemented.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <p>Plan: <span className="font-medium text-slate-950">{company.planType.replaceAll("_", " ")}</span></p>
            <p>Deployment: <span className="font-medium text-slate-950">{company.deploymentType.replaceAll("_", " ")}</span></p>
            <p>Subscription: <span className="font-medium text-slate-950">{company.subscriptionStatus.replaceAll("_", " ")}</span></p>
            <p>Max users: <span className="font-medium text-slate-950">{company.maxUsers ?? "-"}</span></p>
            <p>Storage MB: <span className="font-medium text-slate-950">{company.storageLimitMB ?? "-"}</span></p>
            <p>Expires: <span className="font-medium text-slate-950">{company.subscriptionEndsAt?.toLocaleDateString() ?? company.companysubscription?.expiresAt?.toLocaleDateString() ?? "-"}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Module access</CardTitle>
            <CardDescription>Feature gates for this tenant.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {company.companymoduleaccess.map((item) => (
              <Badge key={item.id} variant={item.isEnabled ? "success" : "secondary"}>
                {item.moduleKey.replaceAll("_", " ")}
              </Badge>
            ))}
            {!company.companymoduleaccess.length ? (
              <p className="text-sm text-slate-500">No module access rows seeded yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      </CardContent>
    </Card>
  );
}
