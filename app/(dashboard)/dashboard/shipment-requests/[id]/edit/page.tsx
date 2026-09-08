import { notFound } from "next/navigation";
import { updateShipmentRequest } from "@/lib/actions/shipment-requests";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { ShipmentRequestForm } from "@/components/forms/shipment-request-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditShipmentRequestPage({ params }: PageProps) {
  const user = await requirePermission("shipmentRequests:update");
  await requireModuleAccess(user.companyId, "SHIPMENTS");
  const { id } = await params;
  const request = await prisma.shipmentrequest.findFirst({
    where: { id, companyId: user.companyId ?? "", deletedAt: null },
  });
  if (!request) notFound();
  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 6.6</Badge>
        <h1 className="mt-3 text-2xl font-semibold">Edit {request.requestNo}</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
        <CardContent>
          <ShipmentRequestForm action={updateShipmentRequest} request={JSON.parse(JSON.stringify(request))} internal />
        </CardContent>
      </Card>
    </main>
  );
}
