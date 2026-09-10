import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PlatformSubscriptionsPage() {
  await requirePlatformPermission("platform:subscriptions:view");
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      planType: true,
      deploymentType: true,
      subscriptionStatus: true,
      subscriptionEndsAt: true,
      maxUsers: true,
    },
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Architecture</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Subscriptions / Licenses</h1>
        <p className="mt-1 text-sm text-slate-600">
          Read-only license overview. Edit values from Platform Companies.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tenant license overview</CardTitle>
          <CardDescription>No invoice, billing, or payment workflow is built here.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden rounded-md border border-slate-200 p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ends</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {companies.map((company) => (
                <tr key={company.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">{company.name}</td>
                  <td className="px-4 py-3 text-slate-600">{company.planType.replaceAll("_", " ")} / {company.deploymentType.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3"><Badge variant={company.subscriptionStatus === "ACTIVE" ? "success" : "secondary"}>{company.subscriptionStatus.replaceAll("_", " ")}</Badge></td>
                  <td className="px-4 py-3 text-slate-600">{company.subscriptionEndsAt?.toLocaleDateString() ?? "-"}</td>
                  <td className="px-4 py-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/platform/companies?edit=${company.id}`}>Edit</Link></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
