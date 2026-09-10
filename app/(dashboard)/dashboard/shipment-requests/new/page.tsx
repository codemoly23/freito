import Link from "next/link";
import { createDashboardShipmentRequest } from "@/lib/actions/shipment-requests";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { ShipmentRequestForm } from "@/components/forms/shipment-request-forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewDashboardShipmentRequestPage() {
  const user = await requirePermission("shipmentRequests:create");
  await requireModuleAccess(user.companyId, "SHIPMENTS");
  const companyId = user.companyId ?? "";

  const customers = await prisma.customer.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/dashboard/shipment-requests">Back to requests</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold mt-1">New Shipment Request</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipment Details</CardTitle>
          <CardDescription>
            Create a shipment request on behalf of a selected client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShipmentRequestForm
            action={createDashboardShipmentRequest}
            customers={customers}
            internal
          />
        </CardContent>
      </Card>
    </main>
  );
}
