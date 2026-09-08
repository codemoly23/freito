import Link from "next/link";
import { notFound } from "next/navigation";
import { PortalBulkDocumentUploadForm } from "@/components/forms/portal-bulk-document-upload-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadMultiplePortalShipmentDocuments } from "@/lib/actions/portal-documents";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalShipmentData } from "@/lib/client-portal/data";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatValue } from "@/lib/pdf/formatters";
import { getDynamicChecklistForShipment } from "@/lib/documents/engine";

export default async function PortalShipmentDetailPage({ params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const shipment = await getPortalShipmentData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!shipment) notFound();

  const activeMasterChecklist = await getDynamicChecklistForShipment(shipment.id);
  const checklist = activeMasterChecklist
    .filter(item => item.owner !== 'INTERNAL' && item.code !== 'debit_note' && item.code !== 'credit_note')
    .map(item => {
      const isRequired = !item.isOptional && item.isRequired;
      return {
        id: item.id,
        name: item.name,
        isRequired,
      };
    });

  const rawOperation = await prisma.shipmentjob.findFirst({
    where: { id, companyId: account.companyId, customerId: account.customerId, deletedAt: null },
    select: {
      freightbooking: { select: { status: true } },
      stuffingplan: { select: { status: true } },
      shippinginstruction: { select: { status: true } },
      billoflading: { select: { approvalStatus: true, releaseStatus: true } },
      cargoreleasechecklist: { select: { status: true } },
    },
  });
  const operation = rawOperation ? {
    freightBooking: rawOperation.freightbooking,
    stuffingPlan: rawOperation.stuffingplan,
    shippingInstruction: rawOperation.shippinginstruction,
    billOfLading: rawOperation.billoflading,
    cargoReleaseChecklist: rawOperation.cargoreleasechecklist,
  } : null;

  const generatedDocs = await prisma.freightdocument.findMany({
    where: {
      shipmentJobId: id,
      companyId: account.companyId,
      isClientVisible: true,
      visibility: "CLIENT_SAFE",
      type: {
        in: [
          "HBL",
          "HAWB",
          "MANIFEST",
          "DEBIT_NOTE",
          "COMMERCIAL_INVOICE",
          "PACKING_LIST",
          "CERTIFICATE_OF_ORIGIN",
          "MSDS_DG_CERTIFICATE",
          "INSURANCE_CERTIFICATE",
          "POD",
          "DELIVERY_CHALLAN",
          "DELIVERY_ORDER",
          "CUSTOMS_RELEASE",
        ],
      },
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  const portalDocuments = shipment.documents.filter(doc => {
    const docConfig = activeMasterChecklist.find(item => item.name.toLowerCase() === doc.documentName.toLowerCase());
    return docConfig && docConfig.owner !== 'INTERNAL' && docConfig.code !== 'debit_note' && docConfig.code !== 'credit_note';
  });

  const action = uploadMultiplePortalShipmentDocuments.bind(null, companySlug);

  return (
    <main className="min-h-screen bg-slate-50 p-5">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap justify-between gap-3">
          <Button asChild variant="outline">
            <Link href={`/portal/${companySlug}/shipments`}>Back to shipments</Link>
          </Button>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/portal/${companySlug}/shipments/${shipment.id}/print`}>Print Summary</Link>
            </Button>
            <Button asChild>
              <a download href={`/api/portal/${companySlug}/shipments/${shipment.id}/summary-pdf`}>Download PDF</a>
            </Button>
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex justify-between gap-3">
              <div>
                <CardTitle>{shipment.jobNo}</CardTitle>
                <p className="text-sm text-slate-500">{shipment.originCountry} to {shipment.destinationCountry}</p>
              </div>
              <Badge variant="secondary">{shipment.currentStatus ?? "In progress"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <p>Mode: {shipment.transportMode}</p>
            <p>Type: {shipment.shipmentType}</p>
            <p>Service scope: {shipment.serviceScope.replaceAll("_", " ")}</p>
            <p>ETD: {formatDate(shipment.etd)}</p>
            <p>ETA: {formatDate(shipment.eta)}</p>
            <p>Booking: {formatValue(shipment.bookingNo)}</p>
            <p className="md:col-span-3">Cargo: {shipment.cargoDescription}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Shipment milestones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shipment.workflowSteps.map((step) => (
              <div className="flex justify-between rounded-md border p-3 text-sm" key={step.title}>
                <div>
                  <p className="font-medium">{step.title}</p>
                  <p className="text-xs text-slate-500">{formatDate(step.completedAt ?? step.dueDate)}</p>
                </div>
                <Badge variant="secondary">{step.status.replaceAll("_", " ")}</Badge>
              </div>
            ))}
            {!shipment.workflowSteps.length ? <p className="text-sm text-slate-500">No customer-visible milestones yet.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Freight operation progress</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-3">
            <p>Booking: <b>{operation?.freightBooking?.status?.replaceAll("_", " ") ?? "Pending"}</b></p>
            <p>Stuffing/loading: <b>{operation?.stuffingPlan?.status?.replaceAll("_", " ") ?? "Not planned"}</b></p>
            <p>Shipping instruction: <b>{operation?.shippingInstruction?.status?.replaceAll("_", " ") ?? "Pending"}</b></p>
            <p>BL/AWB review: <b>{operation?.billOfLading?.approvalStatus?.replaceAll("_", " ") ?? "Pending"}</b></p>
            <p>BL release: <b>{operation?.billOfLading?.releaseStatus?.replaceAll("_", " ") ?? "Pending"}</b></p>
            <p>Cargo release: <b>{operation?.cargoReleaseChecklist?.status?.replaceAll("_", " ") ?? "Pending"}</b></p>
          </CardContent>
        </Card>

        {shipment.containers.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Containers</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-3">Container</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Seal</th>
                    <th className="p-3">Packages</th>
                  </tr>
                </thead>
                <tbody>
                  {shipment.containers.map((container) => (
                    <tr className="border-b" key={container.containerNo}>
                      <td className="p-3">{container.containerNo}</td>
                      <td className="p-3">{formatValue(container.containerType)}</td>
                      <td className="p-3">{formatValue(container.sealNo)}</td>
                      <td className="p-3">{formatValue(container.packageCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ) : null}
        
        {generatedDocs.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Freight Document Review & Approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {generatedDocs.map((doc) => (
                <div className="flex justify-between items-center rounded-md border p-3 text-sm" key={doc.id}>
                  <div>
                    <Link className="font-semibold text-emerald-700 hover:underline" href={`/portal/${companySlug}/shipments/${shipment.id}/freight-documents/${doc.id}`}>
                      {doc.documentNo} ({doc.type})
                    </Link>
                    <p className="text-xs text-slate-500 mt-1">Status: {doc.status}</p>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/portal/${companySlug}/shipments/${shipment.id}/freight-documents/${doc.id}`}>
                      {doc.status === "UNDER_REVIEW" ? "Review & Action" : "View Preview"}
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Required document checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <PortalBulkDocumentUploadForm 
              action={action} 
              shipmentJobId={shipment.id} 
              checklist={checklist} 
              documents={portalDocuments} 
              companySlug={companySlug} 
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
