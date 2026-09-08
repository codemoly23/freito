import { notFound } from "next/navigation";
import { saveQuotation } from "@/lib/actions/finance";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QuotationForm } from "@/components/forms/finance-forms";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditQuotationPage({ params }: PageProps) {
  const currentUser = await requirePermission("quotations:update");
  await requireModuleAccess(currentUser.companyId, "QUOTATIONS");
  const { id } = await params;
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");
  const companyScope = isSuperAdmin ? {} : { companyId: currentUser.companyId ?? "" };
  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, ...companyScope },
    include: {
      quotationcharge: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!quotation) notFound();

  const locked =
    !["DRAFT", "SENT"].includes(quotation.status) &&
    !currentUser.roles.includes("SUPER_ADMIN") &&
    !currentUser.roles.includes("COMPANY_ADMIN");

  const [companies, customers, shipments, vendors] = await Promise.all([
    prisma.company.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findMany({ where: { companyId: quotation.companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({ where: { companyId: quotation.companyId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, jobNo: true } }),
    prisma.vendor.findMany({ where: { companyId: quotation.companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 5</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Edit {quotation.quoteNo}</h1>
      </div>
      {locked ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            This quotation is locked after acceptance, rejection, expiry, or conversion.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Quotation Details</CardTitle>
            <CardDescription>DRAFT and SENT quotations can be edited.</CardDescription>
          </CardHeader>
          <CardContent>
            <QuotationForm
              action={saveQuotation}
              quotation={JSON.parse(JSON.stringify(quotation))}
              charges={JSON.parse(JSON.stringify(quotation.quotationcharge))}
              companyId={quotation.companyId}
              isSuperAdmin={isSuperAdmin}
              companies={companies}
              customers={customers}
              shipments={shipments}
              vendors={vendors}
              canUseAi={hasPermission(currentUser, "ai:use")}
            />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
