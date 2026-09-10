import Link from "next/link";
import { Building2 } from "lucide-react";
import { initializeCompanyAccounting, savePlatformCompany, suspendPlatformCompany } from "@/lib/actions/platform";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePlatformPermission } from "@/lib/permissions/rbac";
import { PlatformCompanyForm } from "@/components/forms/platform-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PageProps = {
  searchParams: Promise<{ q?: string; edit?: string }>;
};

export default async function PlatformCompaniesPage({ searchParams }: PageProps) {
  const currentUser = await requirePlatformPermission("platform:companies:view");
  const { q = "", edit } = await searchParams;

  const [rawCompanies, rawEditing] = await Promise.all([
    prisma.company.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { legalName: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        companymoduleaccess: { orderBy: { moduleKey: "asc" } },
        ledgergroup: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    edit
      ? prisma.company.findFirst({
          where: { id: edit, deletedAt: null },
          include: { companymoduleaccess: { orderBy: { moduleKey: "asc" } } },
        })
      : null,
  ]);

  const companies = rawCompanies.map((c) => ({
    ...c,
    moduleAccess: c.companymoduleaccess,
    accountingInitialized: c.ledgergroup.length > 0,
  }));
  const editing = rawEditing
    ? { ...rawEditing, moduleAccess: rawEditing.companymoduleaccess }
    : null;

  const canCreate = hasPermission(currentUser, "platform:companies:create");
  const canUpdate = hasPermission(currentUser, "platform:companies:update");
  const canSuspend = hasPermission(currentUser, "platform:companies:suspend");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Platform companies</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create tenants, manage lifecycle, and control licensed module access.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit company" : "Create company"}</CardTitle>
            <CardDescription>Platform-controlled subscription and module metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            {(editing && canUpdate) || (!editing && canCreate) ? (
              <PlatformCompanyForm action={savePlatformCompany} editing={editing} />
            ) : (
              <p className="rounded-md border border-slate-200 p-6 text-sm text-slate-500">
                You do not have permission to {editing ? "update" : "create"} companies.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company list</CardTitle>
            <CardDescription>Showing latest 50 active tenant records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2">
              <Input name="q" placeholder="Search company" defaultValue={q} />
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Subscription</th>
                    <th className="px-4 py-3">Modules</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {companies.map((company) => (
                    <tr key={company.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-slate-950">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <Link href={`/platform/companies/${company.id}`} className="hover:underline">
                            {company.name}
                          </Link>
                        </div>
                        <p className="text-xs text-slate-500">{company.email || company.phone || "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{company.planType.replaceAll("_", " ")}</p>
                        <p className="text-xs text-slate-500">{company.deploymentType.replaceAll("_", " ")}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={company.status === "ACTIVE" ? "success" : "warning"}>
                          {company.subscriptionStatus.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {company.moduleAccess.filter((item) => item.isEnabled).length} enabled
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canUpdate ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/platform/companies?edit=${company.id}`}>Edit</Link>
                            </Button>
                          ) : null}
                          {canSuspend ? (
                            <form action={suspendPlatformCompany}>
                              <input type="hidden" name="id" value={company.id} />
                              <Button size="sm" variant="secondary" type="submit">
                                {company.status === "ACTIVE" ? "Suspend" : "Activate"}
                              </Button>
                            </form>
                          ) : null}
                          {canUpdate && !company.accountingInitialized ? (
                            <form action={initializeCompanyAccounting}>
                              <input type="hidden" name="id" value={company.id} />
                              <Button size="sm" variant="outline" type="submit">
                                Initialize Accounting
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!companies.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No companies found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
