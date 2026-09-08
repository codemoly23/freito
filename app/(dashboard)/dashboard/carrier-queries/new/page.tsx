import { createCarrierQuery, sendCarrierQueryBlast } from "@/lib/actions/freight-operations";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CarrierQueryForm } from "@/components/forms/carrier-query-form";

export default async function NewCarrierQueryPage({ searchParams }: { searchParams: Promise<{ shipmentRequestId?: string; shipmentJobId?: string }> }) {
  const user = await requirePermission("carrierQueries:create");
  await requireModuleAccess(user.companyId!, "SHIPMENT_OPERATIONS");
  const params = await searchParams;
  const [vendors, requests, shipments] = await Promise.all([
    prisma.vendor.findMany({
      where: { companyId: user.companyId!, deletedAt: null, status: "ACTIVE" },
      orderBy: { name: "asc" },
      include: { vendorcontact: { where: { email: { not: null } }, select: { email: true }, take: 1 } },
    }),
    prisma.shipmentrequest.findMany({ where: { companyId: user.companyId!, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.shipmentjob.findMany({ where: { companyId: user.companyId!, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const requestOptions = requests.map((request) => ({
    id: request.id,
    label: request.requestNo,
    data: {
      mode: request.transportMode,
      origin: [request.originPort, request.originCountry].filter(Boolean).join(", "),
      destination: [request.destinationPort, request.destinationCountry].filter(Boolean).join(", "),
      cargoSummary: request.cargoDescription,
      hsCode: request.hsCode,
      weight: request.grossWeight?.toString() ?? null,
      cbm: request.cbm?.toString() ?? null,
      packageInfo: [request.packageCount, request.packageType].filter(Boolean).join(" "),
      containerRequirement: request.containerRequirement,
    },
  }));
  const shipmentOptions = shipments.map((shipment) => ({
    id: shipment.id,
    label: shipment.jobNo,
    data: {
      mode: shipment.transportMode,
      origin: [shipment.originPort, shipment.originCountry].filter(Boolean).join(", "),
      destination: [shipment.destinationPort, shipment.destinationCountry].filter(Boolean).join(", "),
      cargoSummary: shipment.cargoDescription,
      hsCode: shipment.hsCode,
      weight: shipment.grossWeight?.toString() ?? null,
      cbm: shipment.cbm?.toString() ?? null,
      packageInfo: [shipment.packageCount, shipment.packageType].filter(Boolean).join(" "),
      containerRequirement: null,
    },
  }));
  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <p className="text-xs uppercase text-slate-500">Phase 8I</p>
        <h1 className="text-2xl font-semibold">New Carrier Query</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Provider buying query</CardTitle>
        </CardHeader>
        <CardContent>
          <CarrierQueryForm
            action={createCarrierQuery}
            blastAction={sendCarrierQueryBlast}
            vendors={vendors.map((v) => ({
              id: v.id,
              name: v.name,
              type: v.type,
              hasEmail: !!(v.email || v.vendorcontact[0]?.email),
            }))}
            requests={requestOptions}
            shipments={shipmentOptions}
            defaultRequestId={params.shipmentRequestId}
            defaultShipmentId={params.shipmentJobId}
          />
        </CardContent>
      </Card>
    </main>
  );
}
