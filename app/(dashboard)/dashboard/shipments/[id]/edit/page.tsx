import { notFound } from "next/navigation";
import { saveShipment } from "@/lib/actions/shipments";
import { requireModuleAccess } from "@/lib/access/company-access";
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
  params: Promise<{ id: string }>;
};

export default async function EditShipmentPage({ params }: PageProps) {
  const currentUser = await requirePermission("shipments:update");
  await requireModuleAccess(currentUser.companyId, "SHIPMENTS");
  const { id } = await params;
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");
  const companyScope = isSuperAdmin ? {} : { companyId: currentUser.companyId ?? "" };

  const shipment = await prisma.shipmentjob.findFirst({
    where: { id, deletedAt: null, ...companyScope },
  });

  if (!shipment) notFound();

  const [companies, customers, users] = await Promise.all([
    prisma.company.findMany({
      where: {
        deletedAt: null,
        ...(isSuperAdmin ? {} : { id: shipment.companyId }),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { companyId: shipment.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { companyId: shipment.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  const shipmentForForm = JSON.parse(JSON.stringify(shipment));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 3</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">
          Edit Shipment {shipment.jobNo}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Update operational details for this shipment job file.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipment details</CardTitle>
          <CardDescription>
            Changes are logged in the audit trail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShipmentForm
            action={saveShipment}
            shipment={shipmentForForm}
            companyId={shipment.companyId}
            isSuperAdmin={isSuperAdmin}
            companies={companies}
            customers={customers}
            users={users}
          />
        </CardContent>
      </Card>
    </main>
  );
}
