import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Ship } from "lucide-react";
import { deleteShipment } from "@/lib/actions/shipments";
import { requireModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { getSavedViewsForPage, savedViewQueryString } from "@/lib/saved-views/queries";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShipmentFilters } from "@/components/forms/shipment-filters";
import { ConfirmDeleteButton } from "@/components/forms/shipment-forms";
import { SaveViewControl } from "@/components/saved-views/save-view-control";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    shipmentType?: string;
    transportMode?: string;
    currentStatus?: string;
    assignedToId?: string;
    etaFrom?: string;
    etaTo?: string;
    etdFrom?: string;
    etdTo?: string;
    page?: string;
  }>;
};

function dateFilter(from?: string, to?: string) {
  if (!from && !to) return {};
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}

function badgeVariant(value?: string | null) {
  if (value === "Closed" || value === "Delivered") return "success";
  if (value?.includes("Risk") || value?.includes("Delayed")) return "danger";
  return "secondary";
}

export default async function ShipmentsPage({ searchParams }: PageProps) {
  const currentUser = await requirePermission("shipments:view");
  await requireModuleAccess(currentUser.companyId, "SHIPMENTS");
  const params = await searchParams;
  const savedViews = await getSavedViewsForPage(currentUser, "shipments");
  if (!Object.values(params).some(Boolean)) {
    const defaultView = savedViews.find((view) => view.isDefault);
    const query = defaultView ? savedViewQueryString(defaultView.filters) : "";
    if (query) redirect(`/dashboard/shipments?${query}`);
  }
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");
  const companyScope = isSuperAdmin ? {} : { companyId: currentUser.companyId ?? "" };
  const accessibleBranchIds =
    !isSuperAdmin && currentUser.companyId
      ? await getAccessibleBranchIds({
          userId: currentUser.id,
          companyId: currentUser.companyId,
          permissions: currentUser.permissions ?? [],
        })
      : null;
  const canViewDocuments = hasPermission(currentUser, "documents:view");
  const canCreate = hasPermission(currentUser, "shipments:create");
  const canUpdate = hasPermission(currentUser, "shipments:update");
  const canDelete = hasPermission(currentUser, "shipments:delete");

  const assignedUsers = await prisma.user.findMany({
    where: { ...companyScope, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const where = {
    ...companyScope,
    ...branchScopeWhere(accessibleBranchIds),
    deletedAt: null,
    ...(params.shipmentType ? { shipmentType: params.shipmentType as never } : {}),
    ...(params.transportMode ? { transportMode: params.transportMode as never } : {}),
    ...(params.currentStatus ? { currentStatus: params.currentStatus } : {}),
    ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
    ...(params.etaFrom || params.etaTo ? { eta: dateFilter(params.etaFrom, params.etaTo) } : {}),
    ...(params.etdFrom || params.etdTo ? { etd: dateFilter(params.etdFrom, params.etdTo) } : {}),
    ...(params.q
      ? {
          OR: [
            { jobNo: { contains: params.q } },
            { customer: { name: { contains: params.q } } },
            { mblNo: { contains: params.q } },
            { hblNo: { contains: params.q } },
            { mawbNo: { contains: params.q } },
            { hawbNo: { contains: params.q } },
            { originCountry: { contains: params.q } },
            { originPort: { contains: params.q } },
            { destinationCountry: { contains: params.q } },
            { destinationPort: { contains: params.q } },
            { containers: { some: { containerNo: { contains: params.q }, deletedAt: null } } },
          ],
        }
      : {}),
  };

  const page = Math.max(1, Number(params.page ?? "1"));
  const limit = 10;
  const skip = (page - 1) * limit;

  const totalCount = await prisma.shipmentjob.count({ where });
  const totalPages = Math.ceil(totalCount / limit);

  const shipmentsRaw = await prisma.shipmentjob.findMany({
    where,
    include: {
      customer: { select: { name: true } },
      user_shipmentjob_assignedToIdTouser: { select: { name: true } },
      container: {
        where: { deletedAt: null },
        select: { containerNo: true },
        take: 2,
      },
      shipmentdocument: {
        where: { deletedAt: null },
        select: { checklistItemId: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: skip,
  });

  const shipments = shipmentsRaw.map((s) => ({
    ...s,
    assignedTo: s.user_shipmentjob_assignedToIdTouser,
    containers: s.container,
    documents: s.shipmentdocument,
  }));

  const checklistItems = canViewDocuments
    ? await prisma.documentchecklistitem.findMany({
        where: {
          isActive: true,
          OR: [
            { companyId: null },
            ...(currentUser.companyId ? [{ companyId: currentUser.companyId }] : []),
          ],
        },
        select: {
          id: true,
          category: true,
          isRequired: true,
        },
      })
    : [];

  function documentCounts(shipment: (typeof shipments)[number]) {
    const requiredChecklist = checklistItems.filter(
      (item) =>
        item.isRequired &&
        (item.category === shipment.shipmentType || item.category === "COMMON"),
    );
    const uploadedChecklistIds = new Set(
      shipment.documents
        .filter((document) => document.checklistItemId)
        .map((document) => document.checklistItemId),
    );
    const missing = requiredChecklist.filter(
      (item) => !uploadedChecklistIds.has(item.id),
    ).length;
    const pending = shipment.documents.filter(
      (document) => document.status === "UPLOADED" || document.status === "REJECTED",
    ).length;
    const verified = shipment.documents.filter(
      (document) => document.status === "VERIFIED",
    ).length;

    return { missing, pending, verified };
  }

  function getPageUrl(pageNum: number) {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.shipmentType) query.set("shipmentType", params.shipmentType);
    if (params.transportMode) query.set("transportMode", params.transportMode);
    if (params.currentStatus) query.set("currentStatus", params.currentStatus);
    if (params.assignedToId) query.set("assignedToId", params.assignedToId);
    if (params.etaFrom) query.set("etaFrom", params.etaFrom);
    if (params.etaTo) query.set("etaTo", params.etaTo);
    if (params.etdFrom) query.set("etdFrom", params.etdFrom);
    if (params.etdTo) query.set("etdTo", params.etdTo);
    query.set("page", pageNum.toString());
    return `/dashboard/shipments?${query.toString()}`;
  }

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="secondary">Phase 3</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Shipments</h1>
          <p className="mt-1 text-sm text-slate-600">
            Central job files for import and export operations.
          </p>
        </div>
        {canCreate ? (
          <Button asChild>
            <Link href="/dashboard/shipments/new">
              <Plus className="h-4 w-4" />
              Create shipment
            </Link>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Shipment List</CardTitle>
            <CardDescription>
              Showing page {page} of {totalPages || 1} ({totalCount} total jobs).
            </CardDescription>
          </div>
          {hasPermission(currentUser, "exports:csv") ? (
            <Button asChild size="sm" variant="outline">
              <a download href="/api/exports/shipments">Download CSV</a>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <ShipmentFilters initialParams={params} assignedUsers={assignedUsers} />
          <SaveViewControl pageKey="shipments" views={savedViews} />
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Route</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">ETA / ETD</th>
                  <th className="px-4 py-3">Assigned</th>
                  {canViewDocuments ? <th className="px-4 py-3">Docs</th> : null}
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {shipments.map((shipment) => {
                  const counts = documentCounts(shipment);

                  return (
                    <tr key={shipment.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/shipments/${shipment.id}`}
                          className="flex items-center gap-2 font-medium text-cyan-600 hover:text-cyan-700 hover:underline"
                        >
                          <Ship className="h-4 w-4 text-slate-400" />
                          {shipment.jobNo}
                        </Link>
                        <div className="mt-1 flex gap-1">
                          <Badge variant={shipment.shipmentType === "IMPORT" ? "warning" : "success"}>{shipment.shipmentType}</Badge>
                          <Badge variant="secondary">{shipment.transportMode}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{shipment.customer.name}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {shipment.originCountry} to {shipment.destinationCountry}
                        <p className="text-xs text-slate-400">
                          {shipment.containers.map((container) => container.containerNo).join(", ") || "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant(shipment.currentStatus)}>{shipment.currentStatus ?? "Not set"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>ETA: {shipment.eta ? shipment.eta.toLocaleDateString() : "-"}</p>
                        <p className="text-xs text-slate-400">ETD: {shipment.etd ? shipment.etd.toLocaleDateString() : "-"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{shipment.assignedTo.name}</td>
                      {canViewDocuments ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={counts.missing ? "warning" : "success"}>{counts.missing} missing</Badge>
                            <Badge variant="secondary">{counts.pending} pending</Badge>
                            <Badge variant="success">{counts.verified} verified</Badge>
                          </div>
                        </td>
                      ) : null}
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/dashboard/shipments/${shipment.id}`}>View</Link>
                          </Button>
                          {canDelete ? (
                            <form action={deleteShipment}>
                              <input type="hidden" name="id" value={shipment.id} />
                              <ConfirmDeleteButton label="Delete" message={`Delete shipment ${shipment.jobNo}?`} />
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!shipments.length ? (
                  <tr>
                    <td colSpan={canViewDocuments ? 8 : 7} className="px-4 py-12 text-center text-slate-500">
                      No shipments found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-4 sm:px-6">
              <div className="flex flex-1 justify-between sm:hidden">
                {page > 1 ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={getPageUrl(page - 1)}>Previous</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
                    Previous
                  </Button>
                )}
                {page < totalPages ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={getPageUrl(page + 1)}>Next</Link>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
                    Next
                  </Button>
                )}
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-700">
                    Showing <span className="font-medium">{skip + 1}</span> to{" "}
                    <span className="font-medium">
                      {Math.min(skip + limit, totalCount)}
                    </span>{" "}
                    of <span className="font-medium">{totalCount}</span> jobs
                  </p>
                </div>
                <div>
                  <nav className="isolate inline-flex gap-1 rounded-md" aria-label="Pagination">
                    {page > 1 ? (
                      <Button asChild variant="outline" size="icon" className="h-8 w-8 p-0">
                        <Link href={getPageUrl(page - 1)}>
                          <span className="sr-only">Previous</span>
                          &lsaquo;
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon" className="h-8 w-8 p-0 cursor-not-allowed opacity-50" disabled>
                        &lsaquo;
                      </Button>
                    )}

                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      const isCurrent = pageNum === page;
                      return (
                        <Button
                          key={pageNum}
                          asChild={!isCurrent}
                          variant={isCurrent ? "default" : "outline"}
                          className={`h-8 w-8 p-0 ${isCurrent ? "pointer-events-none" : ""}`}
                          disabled={isCurrent}
                        >
                          {isCurrent ? (
                            <span>{pageNum}</span>
                          ) : (
                            <Link href={getPageUrl(pageNum)}>{pageNum}</Link>
                          )}
                        </Button>
                      );
                    })}

                    {page < totalPages ? (
                      <Button asChild variant="outline" size="icon" className="h-8 w-8 p-0">
                        <Link href={getPageUrl(page + 1)}>
                          <span className="sr-only">Next</span>
                          &rsaquo;
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" size="icon" className="h-8 w-8 p-0 cursor-not-allowed opacity-50" disabled>
                        &rsaquo;
                      </Button>
                    )}
                  </nav>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
