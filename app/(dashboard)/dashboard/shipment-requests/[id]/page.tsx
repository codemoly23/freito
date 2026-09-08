import Link from "next/link";
import { notFound } from "next/navigation";
import {
  convertAcceptedRequestToShipment,
  convertDirectCompanyRequestToShipment,
  createQuotationFromRequest,
  updateShipmentRequestStatus,
} from "@/lib/actions/shipment-requests";
import { requireModuleAccess, hasModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import {
  RequestStatusForm,
  SimpleActionForm,
} from "@/components/forms/shipment-request-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShareButton } from "@/components/share/share-button";
import { buildEmailShareUrl, buildInternalShareLink, buildWhatsAppShareUrl } from "@/lib/share/share-links";

type PageProps = { params: Promise<{ id: string }> };

function item(label: string, value: unknown) {
  return <div><p className="text-xs uppercase text-slate-400">{label}</p><p className="mt-1 text-sm text-slate-700">{value == null || value === "" ? "-" : String(value)}</p></div>;
}

export default async function ShipmentRequestDetailPage({ params }: PageProps) {
  const user = await requirePermission("shipmentRequests:view");
  await requireModuleAccess(user.companyId, "SHIPMENTS");
  const { id } = await params;
  const rawRequest = await prisma.shipmentrequest.findFirst({
    where: { id, companyId: user.companyId ?? "", deletedAt: null },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      company: { select: { portalSlug: true } },
      quotation: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: { quotationcharge: { where: { deletedAt: null } } },
      },
      shipmentjob: { select: { id: true, jobNo: true } },
    },
  });
  if (!rawRequest) notFound();
  const request = {
    ...rawRequest,
    quotations: (rawRequest.quotation ?? []).map((q) => ({ ...q, charges: q.quotationcharge })),
    convertedShipmentJob: rawRequest.shipmentjob,
  };
  const audits = await prisma.auditlog.findMany({
    where: {
      companyId: request.companyId,
      OR: [
        { entityType: "ShipmentRequest", entityId: request.id },
        { entityType: "Quotation", entityId: { in: request.quotations.map((quotation) => quotation.id) } },
      ],
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const isCompanyCreated = !!request.createdById;
  const quotationModule = await hasModuleAccess(request.companyId, "QUOTATIONS");
  const canUpdate = hasPermission(user, "shipmentRequests:update");
  const canQuote = !isCompanyCreated && quotationModule && hasPermission(user, "shipmentRequests:quote");
  const canConvert = hasPermission(user, "shipmentRequests:convert");
  const latestAccepted = request.quotations.find((quotation) => quotation.status === "ACCEPTED");
  const shareLink = buildInternalShareLink(request.company.portalSlug ? `/portal/${request.company.portalSlug}/requests/${request.id}` : "/");
  const shareMessage = `Shipment request ${request.requestNo} is available from your secure client portal: ${shareLink}`;

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="secondary">{request.status.replaceAll("_", " ")}</Badge>
          <h1 className="mt-3 text-2xl font-semibold">{request.requestNo}</h1>
          <p className="mt-1 text-sm text-slate-600">{request.customer.name}</p>
        </div>
        <div className="flex gap-2">{hasPermission(user, "tasks:create") ? <Button asChild variant="outline"><Link href={`/dashboard/tasks/new?shipmentRequestId=${request.id}&customerId=${request.customerId}&returnTo=/dashboard/shipment-requests/${request.id}`}>Create Task</Link></Button> : null}{hasPermission(user, "share:view") ? <ShareButton resourceType="request" resourceId={request.id} whatsappUrl={buildWhatsAppShareUrl(request.customer.phone, shareMessage)} emailUrl={buildEmailShareUrl(request.customer.email, `Shipment request ${request.requestNo}`, shareMessage)} internalLink={shareLink} canCreateOutbox={hasPermission(user, "share:create")} /> : null}{canUpdate ? <Button asChild variant="outline"><Link href={`/dashboard/shipment-requests/${request.id}/edit`}>Edit request</Link></Button> : null}</div>
      </div>
      <Card>
        <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {item("Shipment", request.shipmentType)}
          {item("Mode", request.transportMode)}
          {item("Service scope", request.serviceScope.replaceAll("_", " "))}
          {item("Origin", `${request.originCountry} / ${request.originPort ?? "-"}`)}
          {item("Destination", `${request.destinationCountry} / ${request.destinationPort ?? "-"}`)}
          {item("Customer reference", request.customerReference)}
          {item("Pickup address", request.pickupAddress)}
          {item("Delivery address", request.deliveryAddress)}
          {item("Expected shipment", request.expectedShipmentDate?.toLocaleDateString())}
          <div className="md:col-span-3">{item("Cargo", request.cargoDescription)}</div>
          <div className="md:col-span-3">{item("Customer notes", request.customerNotes)}</div>
          <div className="md:col-span-3 rounded-md border border-amber-200 bg-amber-50 p-3">{item("Internal notes", request.internalNotes)}</div>
        </CardContent>
      </Card>
      {!isCompanyCreated && (
        <div className="grid gap-4 lg:grid-cols-2">
          {canUpdate ? <Card><CardHeader><CardTitle>Review status</CardTitle></CardHeader><CardContent><RequestStatusForm action={updateShipmentRequestStatus} shipmentRequestId={request.id} internalNotes={request.internalNotes} /></CardContent></Card> : null}
          {canQuote ? <Card><CardHeader><CardTitle>Create quotation</CardTitle><CardDescription>Create a draft proposal prefilled from this request.</CardDescription></CardHeader><CardContent><SimpleActionForm action={createQuotationFromRequest} fields={{ shipmentRequestId: request.id }} label={request.status === "REVISION_REQUESTED" ? "Create revised quotation" : "Create quotation"} /></CardContent></Card> : null}
        </div>
      )}
      {!isCompanyCreated && (
        <Card>
          <CardHeader><CardTitle>Linked quotations</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {request.quotations.map((quotation) => (
              <div key={quotation.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
                <div><p className="font-medium">{quotation.quoteNo}</p><p className="text-sm text-slate-500">{quotation.status} · Sell total BDT {Number(quotation.totalSellAmount).toFixed(2)}</p></div>
                <Button asChild size="sm" variant="outline"><Link href={`/dashboard/quotations/${quotation.id}`}>Open quotation</Link></Button>
              </div>
            ))}
            {!request.quotations.length ? <p className="text-sm text-slate-500">No quotation created yet.</p> : null}
          </CardContent>
        </Card>
      )}
      {isCompanyCreated && canConvert && !request.convertedShipmentJobId ? (
        <Card>
          <CardHeader>
            <CardTitle>Approve & Convert to Shipment</CardTitle>
            <CardDescription>This is an internally created shipment request. Approve and convert it directly to a shipment job file.</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleActionForm action={convertDirectCompanyRequestToShipment} fields={{ shipmentRequestId: request.id }} label="Approve & Convert to Shipment" />
          </CardContent>
        </Card>
      ) : null}
      {!isCompanyCreated && canConvert && latestAccepted && !request.convertedShipmentJobId ? (
        <Card>
          <CardHeader><CardTitle>Convert accepted quotation</CardTitle><CardDescription>This creates a shipment and generates its service-scope workflow.</CardDescription></CardHeader>
          <CardContent><SimpleActionForm action={convertAcceptedRequestToShipment} fields={{ shipmentRequestId: request.id, quotationId: latestAccepted.id }} label="Convert to shipment" /></CardContent>
        </Card>
      ) : null}
      {request.convertedShipmentJob ? <Card><CardContent className="p-5"><Button asChild><Link href={`/dashboard/shipments/${request.convertedShipmentJob.id}`}>Open shipment {request.convertedShipmentJob.jobNo}</Link></Button></CardContent></Card> : null}
      <Card>
        <CardHeader><CardTitle>Audit Log</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {audits.map((log) => <div key={log.id} className="rounded-md border border-slate-200 p-3 text-sm"><div className="flex justify-between"><span className="font-medium">{log.action}</span><span className="text-slate-500">{log.createdAt.toLocaleString()}</span></div><p className="mt-1 text-xs text-slate-500">Actor: {log.user?.name ?? "Client portal"}</p></div>)}
        </CardContent>
      </Card>
    </main>
  );
}
