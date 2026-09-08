import { saveQuotation } from "@/lib/actions/finance";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuotationForm } from "@/components/forms/finance-forms";

export default async function NewQuotationPage() {
  const currentUser = await requirePermission("quotations:create");
  await requireModuleAccess(currentUser.companyId, "QUOTATIONS");
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");
  const companyScope = isSuperAdmin ? {} : { companyId: currentUser.companyId ?? "" };
  const [companies, customers, shipments, vendors] = await Promise.all([
    prisma.company.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { ...companyScope, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({
      where: { ...companyScope, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        jobNo: true,
        customerId: true,
        shipmentType: true,
        transportMode: true,
        loadType: true,
        tradeTerm: true,
        originCountry: true,
        originPort: true,
        destinationCountry: true,
        destinationPort: true,
        cargoDescription: true,
        packageCount: true,
        grossWeight: true,
        chargeableWeight: true,
        cbm: true,
      },
    }),
    prisma.vendor.findMany({
      where: { ...companyScope, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const companyId = currentUser.companyId ?? companies[0]?.id ?? "";

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 5</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Create Quotation</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quotation Details</CardTitle>
          <CardDescription>Enter quotation details and charge lines, then save once.</CardDescription>
        </CardHeader>
        <CardContent>
          <QuotationForm
            action={saveQuotation}
            companyId={companyId}
            isSuperAdmin={isSuperAdmin}
            companies={companies}
            customers={customers}
            shipments={shipments.map((shipment) => ({
              ...shipment,
              grossWeight: shipment.grossWeight?.toString() ?? null,
              chargeableWeight: shipment.chargeableWeight?.toString() ?? null,
              cbm: shipment.cbm?.toString() ?? null,
            }))}
            vendors={vendors}
            canUseAi={hasPermission(currentUser, "ai:use")}
          />
        </CardContent>
      </Card>
    </main>
  );
}
