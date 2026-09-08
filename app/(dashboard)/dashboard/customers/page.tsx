import { notFound, redirect } from "next/navigation";
import { CustomerForm } from "@/components/forms/admin-action-forms";
import { deleteCustomer, saveCustomer } from "@/lib/actions/customers";
import { prisma } from "@/lib/db/prisma";
import { hasModuleAccess } from "@/lib/access/company-access";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { getSavedViewsForPage, savedViewQueryString } from "@/lib/saved-views/queries";
import { SaveViewControl } from "@/components/saved-views/save-view-control";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PageProps = {
  searchParams: Promise<{ q?: string; edit?: string; companyId?: string }>;
};

export default async function CustomersPage({ searchParams }: PageProps) {
  const currentUser = await requirePermission("customers:manage");
  const rawParams = await searchParams;
  const { q = "", edit, companyId: queryCompanyId } = rawParams;
  const savedViews = await getSavedViewsForPage(currentUser, "customers");
  if (!Object.values(rawParams).some(Boolean)) {
    const defaultView = savedViews.find((view) => view.isDefault);
    const query = defaultView ? savedViewQueryString(defaultView.filters) : "";
    if (query) redirect(`/dashboard/customers?${query}`);
  }
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");

  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      ...(isSuperAdmin ? {} : { id: currentUser.companyId ?? "" }),
    },
    orderBy: { name: "asc" },
  });
  const activeCompanyId =
    (isSuperAdmin ? queryCompanyId : currentUser.companyId) ?? companies[0]?.id ?? "";

  const [customers, editing] = await Promise.all([
    prisma.customer.findMany({
      where: {
        companyId: activeCompanyId,
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { code: { contains: q } },
                { email: { contains: q } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      include: { customercontact: { where: { isPrimary: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    edit
      ? isSuperAdmin
        ? prisma.customer.findUnique({
            where: { id: edit },
            include: { customercontact: { where: { isPrimary: true }, take: 1 } },
          })
        : prisma.customer.findFirst({
            where: { id: edit, companyId: currentUser.companyId ?? "" },
            include: { customercontact: { where: { isPrimary: true }, take: 1 } },
          })
      : null,
  ]);

  if (edit && !editing) notFound();

  const primaryContact = editing?.customercontact[0];
  const canManageClientPortal =
    hasPermission(currentUser, "clientPortalAccounts:view") &&
    (await hasModuleAccess(activeCompanyId, "CLIENT_PORTAL"));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 2</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Customers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Maintain customer records and primary contacts.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Customer" : "Create Customer"}</CardTitle>
            <CardDescription>Customers will be used in shipment jobs.</CardDescription>
          </CardHeader>
          <CardContent>
            <CustomerForm
              action={saveCustomer}
              editing={editing}
              activeCompanyId={activeCompanyId}
              primaryContact={primaryContact}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Customer List</CardTitle>
              <CardDescription>Showing latest 50 customer records.</CardDescription>
            </div>
            {hasPermission(currentUser, "exports:csv") ? (
              <Button asChild size="sm" variant="outline">
                <a download href="/api/exports/customers">Download CSV</a>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              {isSuperAdmin ? (
                <select
                  name="companyId"
                  defaultValue={activeCompanyId}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="hidden" name="companyId" value={activeCompanyId} />
              )}
              <Input name="q" placeholder="Search customer" defaultValue={q} />
              <Button type="submit" variant="secondary">Filter</Button>
            </form>
            <SaveViewControl pageKey="customers" views={savedViews} />
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-950">{customer.name}</p>
                        <p className="text-xs text-slate-500">{customer.code ?? customer.binOrVat ?? "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {customer.customercontact[0]?.name ?? customer.email ?? customer.phone ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={customer.status === "ACTIVE" ? "success" : "warning"}>
                          {customer.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a href={`/dashboard/customers/${customer.id}`}>View</a>
                          </Button>
                          {canManageClientPortal ? (
                            <Button asChild size="sm" variant="outline">
                              <a href={`/dashboard/customers/${customer.id}/portal-access`}>Portal</a>
                            </Button>
                          ) : null}
                          <Button asChild size="sm" variant="outline">
                            <a href={`/dashboard/customers?companyId=${activeCompanyId}&edit=${customer.id}`}>Edit</a>
                          </Button>
                          <form action={deleteCustomer}>
                            <input type="hidden" name="id" value={customer.id} />
                            <input type="hidden" name="companyId" value={activeCompanyId} />
                            <Button type="submit" size="sm" variant="destructive">Delete</Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!customers.length ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        No customers found.
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
