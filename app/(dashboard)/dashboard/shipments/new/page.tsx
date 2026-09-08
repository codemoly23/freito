import { redirect } from "next/navigation";
import { saveShipment } from "@/lib/actions/shipments";
import { requireModuleAccess } from "@/lib/access/company-access";
import { getAccessibleBranchIds, getDefaultBranchId } from "@/lib/access/branch-access";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { ShipmentForm } from "@/components/forms/shipment-forms";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageProps = {
  searchParams: Promise<{ companyId?: string }>;
};

export default async function NewShipmentPage({ searchParams }: PageProps) {
  const currentUser = await requirePermission("shipments:create");
  await requireModuleAccess(currentUser.companyId, "SHIPMENTS");
  const { companyId: queryCompanyId } = await searchParams;
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");

  const companies = await prisma.company.findMany({
    where: {
      deletedAt: null,
      ...(isSuperAdmin ? {} : { id: currentUser.companyId ?? "" }),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const activeCompanyId =
    (isSuperAdmin ? queryCompanyId : currentUser.companyId) ?? companies[0]?.id ?? "";

  if (!activeCompanyId) redirect("/dashboard?access=denied");

  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: currentUser.id,
    companyId: activeCompanyId,
    permissions: currentUser.permissions ?? [],
  });
  const defaultBranchId = await getDefaultBranchId(currentUser.id, activeCompanyId);

  const [customers, users, requests, quotations, branches] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: activeCompanyId, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { companyId: activeCompanyId, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.shipmentrequest.findMany({
      where: { companyId: activeCompanyId, deletedAt: null, convertedShipmentJobId: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.quotation.findMany({
      where: { companyId: activeCompanyId, deletedAt: null, convertedShipmentJobId: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.branch.findMany({
      where: {
        companyId: activeCompanyId,
        isActive: true,
        deletedAt: null,
        ...(accessibleBranchIds !== null ? { id: { in: accessibleBranchIds } } : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const sourceRecords = [
    ...requests.map((request) => ({
      value: `request:${request.id}`,
      label: `Request ${request.requestNo}`,
      data: {
        customerId: request.customerId,
        shipmentType: request.shipmentType,
        transportMode: request.transportMode,
        serviceScope: request.serviceScope,
        loadType: request.loadType,
        tradeTerm: request.incoterm,
        originCountry: request.originCountry,
        originPort: request.originPort,
        destinationCountry: request.destinationCountry,
        destinationPort: request.destinationPort,
        pickupAddress: request.pickupAddress,
        deliveryAddress: request.deliveryAddress,
        cargoDescription: request.cargoDescription,
        hsCode: request.hsCode,
        packageCount: request.packageCount,
        packageType: request.packageType,
        grossWeight: request.grossWeight?.toString() ?? null,
        netWeight: request.netWeight?.toString() ?? null,
        chargeableWeight: request.chargeableWeight?.toString() ?? null,
        cbm: request.cbm?.toString() ?? null,
        etd: request.requestedEtd?.toISOString().slice(0, 10) ?? null,
        eta: request.requestedEta?.toISOString().slice(0, 10) ?? null,
      },
    })),
    ...quotations.map((quotation) => ({
      value: `quotation:${quotation.id}`,
      label: `Quotation ${quotation.quoteNo}`,
      data: {
        customerId: quotation.customerId,
        shipmentType: quotation.shipmentType,
        transportMode: quotation.transportMode,
        loadType: quotation.loadType,
        tradeTerm: quotation.tradeTerm,
        originCountry: quotation.originCountry,
        originPort: quotation.originPort,
        destinationCountry: quotation.destinationCountry,
        destinationPort: quotation.destinationPort,
        cargoDescription: quotation.cargoDescription,
        packageCount: quotation.packageCount,
        grossWeight: quotation.grossWeight?.toString() ?? null,
        chargeableWeight: quotation.chargeableWeight?.toString() ?? null,
        cbm: quotation.cbm?.toString() ?? null,
      },
    })),
  ];

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 3</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">
          Create Shipment
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Create one central job file for an import or export shipment.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipment details</CardTitle>
          <CardDescription>
            Required fields are customer, shipment type, transport mode, load
            type, origin, destination, cargo, and assigned employee.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShipmentForm
            action={saveShipment}
            companyId={activeCompanyId}
            isSuperAdmin={isSuperAdmin}
            companies={companies}
            customers={customers}
            users={users}
            branches={branches}
            defaultBranchId={defaultBranchId}
            sourceRecords={sourceRecords}
          />
        </CardContent>
      </Card>
    </main>
  );
}
