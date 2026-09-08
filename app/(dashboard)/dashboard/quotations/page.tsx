import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { deleteQuotation } from "@/lib/actions/finance";
import { requireModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { getSavedViewsForPage, savedViewQueryString } from "@/lib/saved-views/queries";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteButton } from "@/components/forms/shipment-forms";
import { SaveViewControl } from "@/components/saved-views/save-view-control";

type PageProps = {
  searchParams: Promise<{ q?: string; status?: string; customerId?: string }>;
};

function money(value: unknown) {
  return `BDT ${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusVariant(status: string) {
  if (status === "ACCEPTED" || status === "CONVERTED") return "success";
  if (status === "REJECTED" || status === "EXPIRED") return "danger";
  if (status === "SENT") return "warning";
  return "secondary";
}

export default async function QuotationsPage({ searchParams }: PageProps) {
  const currentUser = await requirePermission("quotations:view");
  await requireModuleAccess(currentUser.companyId, "QUOTATIONS");
  const params = await searchParams;
  const savedViews = await getSavedViewsForPage(currentUser, "quotations");
  if (!Object.values(params).some(Boolean)) {
    const defaultView = savedViews.find((view) => view.isDefault);
    const query = defaultView ? savedViewQueryString(defaultView.filters) : "";
    if (query) redirect(`/dashboard/quotations?${query}`);
  }
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");
  const companyScope = isSuperAdmin ? {} : { companyId: currentUser.companyId ?? "" };
  const accessibleBranchIds = isSuperAdmin || !currentUser.companyId
    ? null
    : await getAccessibleBranchIds({ userId: currentUser.id, companyId: currentUser.companyId, permissions: currentUser.permissions ?? [] });

  const [customers, quotations] = await Promise.all([
    prisma.customer.findMany({
      where: { ...companyScope, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.quotation.findMany({
      where: {
        ...companyScope,
        deletedAt: null,
        ...branchScopeWhere(accessibleBranchIds),
        ...(params.status ? { status: params.status as never } : {}),
        ...(params.customerId ? { customerId: params.customerId } : {}),
        ...(params.q
          ? {
              OR: [
                { quoteNo: { contains: params.q } },
                { customer: { name: { contains: params.q } } },
                { originCountry: { contains: params.q } },
                { destinationCountry: { contains: params.q } },
              ],
            }
          : {}),
      },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const canCreate = hasPermission(currentUser, "quotations:create");
  const canUpdate = hasPermission(currentUser, "quotations:update");
  const canDelete = hasPermission(currentUser, "quotations:delete");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="secondary">Sales Quotes</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Quotations</h1>
          <p className="mt-1 text-sm text-slate-600">Customer offers and sales quotes. Accepted quotations can move forward into shipment job files when conversion is available.</p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/quotations/new">
              <Plus className="h-4 w-4" />
              Create quotation
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Quotation List</CardTitle>
            <CardDescription>Latest customer quotes with status, route, sell amount, and next actions.</CardDescription>
          </div>
          {hasPermission(currentUser, "exports:csv") ? (
            <Button asChild size="sm" variant="outline">
              <a download href="/api/exports/quotations">Download CSV</a>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="grid gap-3 md:grid-cols-4">
            <Input name="q" placeholder="Search quote, customer, route" defaultValue={params.q ?? ""} />
            <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="">All statuses</option>
              {["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED", "CONVERTED"].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select name="customerId" defaultValue={params.customerId ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Filter</Button>
          </form>
          <SaveViewControl pageKey="quotations" views={savedViews} />

          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Quote / Status</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Sell / Profit</th>
                  <th className="px-4 py-3">Margin</th>
                  <th className="px-4 py-3 text-right">Open Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {quotations.map((quotation) => (
                  <tr key={quotation.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-950">{quotation.quoteNo}</p>
                      <Badge variant={statusVariant(quotation.status)}>{quotation.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{quotation.customer.name}</td>
                    <td className="px-4 py-3 text-slate-600">{quotation.originCountry ?? "-"} to {quotation.destinationCountry ?? "-"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{money(quotation.totalSellAmount)}</p>
                      <p className={Number(quotation.grossProfit) < 0 ? "text-red-600" : "text-emerald-700"}>{money(quotation.grossProfit)}</p>
                    </td>
                    <td className="px-4 py-3">{Number(quotation.profitMarginPercent).toFixed(2)}%</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button asChild size="sm" variant="outline"><Link href={`/dashboard/quotations/${quotation.id}`}>View</Link></Button>
                        {canUpdate ? <Button asChild size="sm" variant="outline"><Link href={`/dashboard/quotations/${quotation.id}/edit`}>Edit</Link></Button> : null}
                        {canDelete ? (
                          <form action={deleteQuotation}>
                            <input type="hidden" name="id" value={quotation.id} />
                            <ConfirmDeleteButton label="Delete" message={`Delete quotation ${quotation.quoteNo}?`} />
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!quotations.length ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No quotations found. Try clearing filters or create a new customer quote.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
