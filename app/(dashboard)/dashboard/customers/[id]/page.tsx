import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AiCustomerInsightsCard } from "@/components/customers/ai-customer-insights-card";

type PageProps = { params: Promise<{ id: string }> };

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-normal text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{children}</p>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const currentUser = await requirePermission("customers:manage");
  const { id } = await params;
  const companyId = currentUser.companyId ?? "";

  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: currentUser.id,
    companyId,
    permissions: currentUser.permissions ?? [],
  });
  const branchWhere = branchScopeWhere(accessibleBranchIds);

  const customer = await prisma.customer.findFirst({
    where: { id, companyId, deletedAt: null },
    include: {
      customercontact: { where: { isPrimary: true }, take: 1 },
      _count: {
        select: {
          shipmentjob: { where: { deletedAt: null, ...branchWhere } },
          invoice: { where: { deletedAt: null, ...branchWhere } },
          quotation: { where: { deletedAt: null, ...branchWhere } },
        },
      },
    },
  });
  if (!customer) notFound();

  const canUseAi = hasPermission(currentUser, "ai:use");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="secondary">Customer</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">{customer.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={customer.status === "ACTIVE" ? "success" : "warning"}>{customer.status}</Badge>
          </div>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/customers?edit=${customer.id}`}>Edit</Link>
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Core customer account details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <DetailItem label="Customer code">{customer.code ?? "-"}</DetailItem>
            <DetailItem label="BIN / VAT">{customer.binOrVat ?? "-"}</DetailItem>
            <DetailItem label="Email">{customer.email ?? "-"}</DetailItem>
            <DetailItem label="Phone">{customer.phone ?? "-"}</DetailItem>
            <DetailItem label="Address">{customer.address ?? "-"}</DetailItem>
            <DetailItem label="Primary contact">{customer.customercontact[0]?.name ?? "-"}</DetailItem>
            <DetailItem label="Customer since">{customer.createdAt.toLocaleDateString()}</DetailItem>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Record counts visible to your branch access.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <DetailItem label="Shipments">{String(customer._count.shipmentjob)}</DetailItem>
            <DetailItem label="Quotations">{String(customer._count.quotation)}</DetailItem>
            <DetailItem label="Invoices">{String(customer._count.invoice)}</DetailItem>
          </CardContent>
        </Card>
      </section>

      {canUseAi ? (
        <section>
          <AiCustomerInsightsCard customerId={customer.id} />
        </section>
      ) : null}
    </main>
  );
}
