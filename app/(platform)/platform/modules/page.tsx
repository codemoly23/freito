import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PlatformModulesPage() {
  await requirePlatformPermission("platform:modules:update");
  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    include: { companymoduleaccess: { orderBy: { moduleKey: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Module Access</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Module Access</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tenant feature gates. Configure from the company edit form.
        </p>
      </div>
      <div className="grid gap-4">
        {companies.map((company) => (
          <Card key={company.id}>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>{company.name}</CardTitle>
                <CardDescription>{company.planType.replaceAll("_", " ")} license</CardDescription>
              </div>
              <Button asChild size="sm" variant="outline"><Link href={`/platform/companies?edit=${company.id}`}>Edit</Link></Button>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {company.companymoduleaccess.map((item) => (
                <Badge key={item.id} variant={item.isEnabled ? "success" : "secondary"}>
                  {item.moduleKey.replaceAll("_", " ")}
                </Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
