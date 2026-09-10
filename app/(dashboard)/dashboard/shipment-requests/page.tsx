import Link from "next/link";
import { requireModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    customerId?: string;
    serviceScope?: string;
    transportMode?: string;
    source?: string;
  }>;
};

function variant(status: string) {
  if (["ACCEPTED", "CONVERTED"].includes(status)) return "success";
  if (["REJECTED", "CANCELLED"].includes(status)) return "danger";
  if (["UNDER_REVIEW", "QUOTED", "REVISION_REQUESTED"].includes(status))
    return "warning";
  return "secondary";
}

export default async function ShipmentRequestsPage({
  searchParams,
}: PageProps) {
  const user = await requirePermission("shipmentRequests:view");
  await requireModuleAccess(user.companyId, "SHIPMENTS");
  const filters = await searchParams;
  const companyId = user.companyId ?? "";
  const accessibleBranchIds = await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] });
  const [rawRequests, customers] = await Promise.all([
    prisma.shipmentrequest.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...branchScopeWhere(accessibleBranchIds),
        ...(filters.status ? { status: filters.status as never } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.serviceScope
          ? { serviceScope: filters.serviceScope as never }
          : {}),
        ...(filters.transportMode
          ? { transportMode: filters.transportMode as never }
          : {}),
        ...(filters.source ? { source: filters.source } : {}),
      },
      include: {
        customer: { select: { name: true } },
        user_shipmentrequest_createdByIdTouser: { select: { name: true } },
        clientportalaccount: { select: { email: true, clientCode: true } },
        quotation: {
          where: { deletedAt: null },
          select: { id: true, quoteNo: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const requests = rawRequests.map((r) => ({
    ...r,
    createdBy: r.user_shipmentrequest_createdByIdTouser,
    clientPortalAccount: r.clientportalaccount,
    quotations: r.quotation,
  }));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mt-3 text-2xl font-semibold">Shipment Requests</h1>
          <p className="mt-1 text-sm text-slate-600">
            Customer-submitted requests and quotation progress.
          </p>
        </div>
        {hasPermission(user, "shipmentRequests:create") && (
          <Button asChild>
            <Link href="/dashboard/shipment-requests/new">New Request</Link>
          </Button>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
            <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="">All statuses</option>
              {["SUBMITTED", "UNDER_REVIEW", "QUOTED", "REVISION_REQUESTED", "ACCEPTED", "REJECTED", "CONVERTED", "CANCELLED"].map((status) => (
                <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
              ))}
            </select>
            <select name="customerId" defaultValue={filters.customerId ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="">All customers</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
            <select name="serviceScope" defaultValue={filters.serviceScope ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="">All service scopes</option>
              {["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"].map((scope) => <option key={scope} value={scope}>{scope.replaceAll("_", " ")}</option>)}
            </select>
            <select name="source" defaultValue={filters.source ?? ""} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
              <option value="">All sources</option>
              <option value="CLIENT_PORTAL">Client Portal</option>
              <option value="COMPANY_DASHBOARD">Company Dashboard</option>
            </select>
            <div className="flex gap-2">
              <select name="transportMode" defaultValue={filters.transportMode ?? ""} className="h-10 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm">
                <option value="">All modes</option>
                {["SEA", "AIR", "LAND"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
              <Button type="submit">Filter</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Request</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Created By</th>
                  <th className="px-4 py-3">Scope / Mode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Quotation</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{request.requestNo}</p>
                      <p className="text-xs text-slate-500">{request.createdAt.toLocaleString()}</p>
                    </td>
                    <td className="px-4 py-3">{request.customer.name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={request.source === "COMPANY_DASHBOARD" ? "secondary" : "default"}>
                        {request.source === "COMPANY_DASHBOARD" ? "Company Dashboard" : "Client Portal"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {request.source === "COMPANY_DASHBOARD"
                        ? (request.createdBy?.name ?? "Employee")
                        : (request.clientPortalAccount?.email ?? request.clientPortalAccount?.clientCode ?? "Portal Client")}
                    </td>
                    <td className="px-4 py-3">{request.serviceScope.replaceAll("_", " ")} / {request.transportMode}</td>
                    <td className="px-4 py-3"><Badge variant={variant(request.status)}>{request.status.replaceAll("_", " ")}</Badge></td>
                    <td className="px-4 py-3">{request.quotations[0] ? `${request.quotations[0].quoteNo} (${request.quotations[0].status})` : "-"}</td>
                    <td className="px-4 py-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/shipment-requests/${request.id}`}>View</Link></Button></td>
                  </tr>
                ))}
                {!requests.length ? <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No shipment requests found.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
