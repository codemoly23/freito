import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import {
  deleteQuotationCharge,
  saveQuotationCharge,
  updateQuotationStatus,
} from "@/lib/actions/finance";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChargeForm } from "@/components/forms/finance-forms";
import { ConfirmDeleteButton } from "@/components/forms/shipment-forms";
import { ShareButton } from "@/components/share/share-button";
import { buildEmailShareUrl, buildInternalShareLink, buildWhatsAppShareUrl } from "@/lib/share/share-links";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";

type PageProps = { params: Promise<{ id: string }> };

function money(value: unknown) {
  return `BDT ${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusVariant(status: string) {
  if (status === "ACCEPTED" || status === "CONVERTED") return "success";
  if (status === "REJECTED" || status === "EXPIRED") return "danger";
  if (status === "SENT") return "warning";
  return "secondary";
}

export default async function QuotationDetailPage({ params }: PageProps) {
  const currentUser = await requirePermission("quotations:view");
  await requireModuleAccess(currentUser.companyId, "QUOTATIONS");
  const { id } = await params;
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");
  const companyScope = isSuperAdmin ? {} : { companyId: currentUser.companyId ?? "" };
  const branchScope = isSuperAdmin || !currentUser.companyId
    ? {}
    : branchScopeWhere(await getAccessibleBranchIds({ userId: currentUser.id, companyId: currentUser.companyId, permissions: currentUser.permissions ?? [] }));
  const quotation = await prisma.quotation.findFirst({
    where: { id, deletedAt: null, ...companyScope, ...branchScope },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      company: { select: { portalSlug: true } },
      shipmentjob_quotation_shipmentJobIdToshipmentjob: { select: { jobNo: true } },
      quotationcharge: {
        where: { deletedAt: null },
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!quotation) notFound();

  const shipmentJob = quotation.shipmentjob_quotation_shipmentJobIdToshipmentjob;
  const charges = quotation.quotationcharge;

  const allQuotationChargeIds = await prisma.quotationcharge.findMany({
    where: {
      companyId: quotation.companyId,
      quotationId: quotation.id,
    },
    select: { id: true },
  });

  const [vendors, auditLogs] = await Promise.all([
    prisma.vendor.findMany({
      where: { companyId: quotation.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.auditlog.findMany({
      where: {
        companyId: quotation.companyId,
        OR: [
          { entityType: "Quotation", entityId: quotation.id },
          { entityType: "QuotationCharge", entityId: { in: allQuotationChargeIds.map((charge) => charge.id) } },
        ],
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const canUpdate = hasPermission(currentUser, "quotations:update");
  const canApprove = hasPermission(currentUser, "quotations:approve");
  const canConvert = hasPermission(currentUser, "quotations:convert");
  const isNegative = Number(quotation.grossProfit) < 0;
  const sharePath = quotation.company.portalSlug ? `/portal/${quotation.company.portalSlug}/quotations/${quotation.id}` : "/";
  const shareLink = buildInternalShareLink(sharePath);
  const shareMessage = `Quotation ${quotation.quoteNo} is available from your secure client portal: ${shareLink}`;

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant={statusVariant(quotation.status)}>{quotation.status}</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">{quotation.quoteNo}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Customer sales quote for {quotation.customer.name}. Accepted quotations can convert to a shipment job file when linked to an accepted request.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(currentUser, "tasks:create") ? <Button asChild variant="outline"><Link href={`/dashboard/tasks/new?quotationId=${quotation.id}&customerId=${quotation.customerId}&shipmentJobId=${quotation.shipmentJobId ?? ""}&shipmentRequestId=${quotation.shipmentRequestId ?? ""}&returnTo=/dashboard/quotations/${quotation.id}`}>Create Task</Link></Button> : null}
          {hasPermission(currentUser, "share:view") ? <ShareButton resourceType="quotation" resourceId={quotation.id} whatsappUrl={buildWhatsAppShareUrl(quotation.customer.phone, shareMessage)} emailUrl={buildEmailShareUrl(quotation.customer.email, `Quotation ${quotation.quoteNo}`, shareMessage)} internalLink={shareLink} printUrl={hasPermission(currentUser, "exports:print") ? `/dashboard/quotations/${quotation.id}/print` : null} downloadUrl={hasPermission(currentUser, "exports:pdf") ? `/api/quotations/${quotation.id}/pdf` : null} canCreateOutbox={hasPermission(currentUser, "share:create")} /> : null}
          {hasPermission(currentUser, "exports:print") ? <Button asChild variant="outline"><Link href={`/dashboard/quotations/${quotation.id}/print`}>Print</Link></Button> : null}
          {hasPermission(currentUser, "exports:pdf") ? <Button asChild variant="outline"><a download href={`/api/quotations/${quotation.id}/pdf`}>Download PDF</a></Button> : null}
          {canUpdate ? <Button asChild variant="outline"><Link href={`/dashboard/quotations/${quotation.id}/edit`}><Pencil className="h-4 w-4" />Edit</Link></Button> : null}
          {quotation.shipmentRequestId ? <Button asChild variant="outline"><Link href={`/dashboard/shipment-requests/${quotation.shipmentRequestId}`}>Open request</Link></Button> : null}
          {canConvert && !quotation.shipmentRequestId ? <Button type="button" disabled variant="outline">Conversion requires an accepted request</Button> : null}
        </div>
      </div>

      {isNegative ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          Warning: this quotation has negative profit.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Total buy" value={money(quotation.totalBuyAmount)} />
        <SummaryCard label="Total sell" value={money(quotation.totalSellAmount)} />
        <SummaryCard label="Gross profit" value={money(quotation.grossProfit)} danger={isNegative} />
        <SummaryCard label="Margin" value={`${Number(quotation.profitMarginPercent).toFixed(2)}%`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>{quotation.originCountry ?? "-"} to {quotation.destinationCountry ?? "-"} {shipmentJob ? `linked to job file ${shipmentJob.jobNo}` : "not converted to a job file yet"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3 text-sm text-slate-600">
          <p>Shipment: {quotation.shipmentType ?? "-"}</p>
          <p>Mode: {quotation.transportMode ?? "-"}</p>
          <p>Valid until: {quotation.validUntil ? quotation.validUntil.toLocaleDateString() : "-"}</p>
          <p className="md:col-span-3">Cargo: {quotation.cargoDescription ?? "-"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Charges</CardTitle>
          <CardDescription>Buy and sell rate lines for the customer offer. Totals are recalculated server-side.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {canUpdate ? <ChargeForm action={saveQuotationCharge} quotationId={quotation.id} vendors={vendors} /> : null}
          <ChargeTable charges={charges} canDelete={canUpdate} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status Actions</CardTitle>
          <CardDescription>Move the quotation through draft, sent, accepted, rejected, expired, and conversion-ready sales states.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {canUpdate ? <StatusButton quotationId={quotation.id} status="SENT" /> : null}
          {canApprove && !quotation.shipmentRequestId ? (
            <>
              <StatusButton quotationId={quotation.id} status="ACCEPTED" />
              <StatusButton quotationId={quotation.id} status="REJECTED" />
              <StatusButton quotationId={quotation.id} status="EXPIRED" />
            </>
          ) : canApprove ? <StatusButton quotationId={quotation.id} status="EXPIRED" /> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>Latest quotation activity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium text-slate-950">{log.action}</span>
                <span className="text-slate-500">{log.createdAt.toLocaleString()}</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">Actor: {log.user?.name ?? log.user?.email ?? "-"}</p>
            </div>
          ))}
          {!auditLogs.length ? <p className="rounded-md border border-slate-200 p-6 text-center text-sm text-slate-500">No audit entries yet.</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}

function SummaryCard({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={danger ? "mt-2 text-xl font-semibold text-red-600" : "mt-2 text-xl font-semibold text-slate-950"}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ChargeTable({
  charges,
  canDelete,
}: {
  charges: Array<{
    id: string;
    chargeName: string;
    chargeType: string;
    chargeBasis: string;
    quantity: unknown;
    currency: string;
    buyAmount: unknown;
    sellAmount: unknown;
    profitAmount: unknown;
  }>;
  canDelete: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-3">Charge</th>
            <th className="px-4 py-3">Qty / Currency</th>
            <th className="px-4 py-3">Buy / Sell</th>
            <th className="px-4 py-3">Profit</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {charges.map((charge) => (
            <tr key={charge.id}>
              <td className="px-4 py-3"><p className="font-medium text-slate-950">{charge.chargeName}</p><p className="text-xs text-slate-500">{charge.chargeType} / {charge.chargeBasis}</p></td>
              <td className="px-4 py-3">{String(charge.quantity)} {charge.currency}</td>
              <td className="px-4 py-3"><p>{money(charge.buyAmount)}</p><p>{money(charge.sellAmount)}</p></td>
              <td className={Number(charge.profitAmount) < 0 ? "px-4 py-3 text-red-600" : "px-4 py-3 text-emerald-700"}>{money(charge.profitAmount)}</td>
              <td className="px-4 py-3 text-right">
                {canDelete ? (
                  <form action={deleteQuotationCharge}>
                    <input type="hidden" name="id" value={charge.id} />
                    <ConfirmDeleteButton label="Delete" message={`Delete charge ${charge.chargeName}?`} />
                  </form>
                ) : null}
              </td>
            </tr>
          ))}
          {!charges.length ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No charges added yet. Add buy and sell lines before sending the customer quote.</td></tr> : null}
        </tbody>
      </table>
    </div>
  );
}

function StatusButton({ quotationId, status }: { quotationId: string; status: string }) {
  return (
    <form action={updateQuotationStatus}>
      <input type="hidden" name="quotationId" value={quotationId} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant="outline">{status}</Button>
    </form>
  );
}
