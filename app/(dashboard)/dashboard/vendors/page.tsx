import { notFound, redirect } from "next/navigation";
import { VendorForm } from "@/components/forms/admin-action-forms";
import { deleteVendor, saveVendor } from "@/lib/actions/vendors";
import { prisma } from "@/lib/db/prisma";
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
  searchParams: Promise<{
    q?: string;
    edit?: string;
    companyId?: string;
    type?: string;
    status?: string;
  }>;
};

const vendorTypes = [
  "SHIPPING_LINE",
  "AIRLINE",
  "C_AND_F_AGENT",
  "TRUCK_VENDOR",
  "WAREHOUSE_CFS",
  "OVERSEAS_AGENT",
  "INSURANCE_PROVIDER",
  "BANK",
  "OTHER",
];

export default async function VendorsPage({ searchParams }: PageProps) {
  const currentUser = await requirePermission("vendors:manage");
  const rawParams = await searchParams;
  const {
    q = "",
    edit,
    companyId: queryCompanyId,
    type = "",
    status = "",
  } = rawParams;
  const savedViews = await getSavedViewsForPage(currentUser, "vendors");
  if (!Object.values(rawParams).some(Boolean)) {
    const defaultView = savedViews.find((view) => view.isDefault);
    const query = defaultView ? savedViewQueryString(defaultView.filters) : "";
    if (query) redirect(`/dashboard/vendors?${query}`);
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

  const [vendors, editing] = await Promise.all([
    prisma.vendor.findMany({
      where: {
        companyId: activeCompanyId,
        deletedAt: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(type && vendorTypes.includes(type) ? { type: type as any } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(status && ["ACTIVE", "INACTIVE"].includes(status) ? { status: status as any } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { phone: { contains: q } },
              ],
            }
          : {}),
      },
      include: { vendorcontact: { where: { isPrimary: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    edit
      ? isSuperAdmin
        ? prisma.vendor.findUnique({
            where: { id: edit },
            include: { vendorcontact: { where: { isPrimary: true }, take: 1 } },
          })
        : prisma.vendor.findFirst({
            where: { id: edit, companyId: currentUser.companyId ?? "" },
            include: { vendorcontact: { where: { isPrimary: true }, take: 1 } },
          })
      : null,
  ]);

  if (edit && !editing) notFound();

  const primaryContact = editing?.vendorcontact[0];

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 2</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Vendors</h1>
        <p className="mt-1 text-sm text-slate-600">
          Maintain shipping lines, agents, truckers, warehouses, banks, and service vendors.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Vendor" : "Create Vendor"}</CardTitle>
            <CardDescription>Vendor master data for operations and accounts.</CardDescription>
          </CardHeader>
          <CardContent>
            <VendorForm
              action={saveVendor}
              editing={editing}
              activeCompanyId={activeCompanyId}
              primaryContact={primaryContact}
              vendorTypes={vendorTypes}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Vendor List</CardTitle>
              <CardDescription>Showing latest 50 vendor records.</CardDescription>
            </div>
            {hasPermission(currentUser, "exports:csv") ? (
              <Button asChild size="sm" variant="outline">
                <a download href="/api/exports/vendors">Download CSV</a>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <form method="GET" className="flex flex-col gap-3 md:flex-row md:items-end md:flex-wrap">
              {isSuperAdmin && (
                <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                  <span className="text-xs font-medium text-slate-500">Company</span>
                  <select
                    name="companyId"
                    defaultValue={activeCompanyId}
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-slate-400 focus:outline-none"
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isSuperAdmin && (
                <input type="hidden" name="companyId" value={activeCompanyId} />
              )}
              
              <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                <span className="text-xs font-medium text-slate-500">Search</span>
                <Input name="q" placeholder="Search vendor name, email..." defaultValue={q} />
              </div>

              <div className="flex flex-col gap-1.5 min-w-[150px]">
                <span className="text-xs font-medium text-slate-500">Vendor Type</span>
                <select
                  name="type"
                  defaultValue={type}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="">All Types</option>
                  {vendorTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 min-w-[120px]">
                <span className="text-xs font-medium text-slate-500">Status</span>
                <select
                  name="status"
                  defaultValue={status}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-slate-400 focus:outline-none"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2 md:pt-0">
                <Button type="submit" variant="secondary">
                  Filter
                </Button>
                {(q || type || status) && (
                  <Button asChild variant="outline">
                    <a href={`/dashboard/vendors?companyId=${activeCompanyId}`}>
                      Reset
                    </a>
                  </Button>
                )}
              </div>
            </form>
            <SaveViewControl pageKey="vendors" views={savedViews} />
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-950">{vendor.name}</p>
                        <p className="text-xs text-slate-500">{vendor.type.replaceAll("_", " ")}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {vendor.vendorcontact[0]?.name ?? vendor.email ?? vendor.phone ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={vendor.status === "ACTIVE" ? "success" : "warning"}>
                          {vendor.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a href={`/dashboard/vendors?companyId=${activeCompanyId}&edit=${vendor.id}`}>Edit</a>
                          </Button>
                          <form action={deleteVendor}>
                            <input type="hidden" name="id" value={vendor.id} />
                            <input type="hidden" name="companyId" value={activeCompanyId} />
                            <Button type="submit" size="sm" variant="destructive">Delete</Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!vendors.length ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        No vendors found.
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
