import Link from "next/link";
import { notFound } from "next/navigation";
import { respondToPortalQuotation } from "@/lib/actions/shipment-requests";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";
import { PortalQuotationResponseForm } from "@/components/forms/shipment-request-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { params: Promise<{ companySlug: string; id: string }> };

function money(value: unknown) {
  return `BDT ${Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function PortalRequestDetailPage({ params }: PageProps) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const rawRequest = await prisma.shipmentrequest.findFirst({
    where: {
      id,
      companyId: account.companyId,
      customerId: account.customerId,
      clientPortalAccountId: account.id,
      deletedAt: null,
    },
    include: {
      quotation: {
        where: { deletedAt: null },
        select: {
          id: true,
          quoteNo: true,
          status: true,
          validUntil: true,
          totalSellAmount: true,
          quotationcharge: {
            where: { deletedAt: null },
            select: {
              id: true,
              chargeName: true,
              chargeType: true,
              currency: true,
              quantity: true,
              sellRate: true,
              sellAmount: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!rawRequest) notFound();
  const request = {
    ...rawRequest,
    quotations: rawRequest.quotation.map((q) => ({
      ...q,
      charges: q.quotationcharge,
    })),
  };
  const latest = request.quotations[0];
  const customerVisible =
    latest &&
    ["SENT", "ACCEPTED", "REJECTED", "CONVERTED"].includes(latest.status)
      ? latest
      : null;
  const responseAction = respondToPortalQuotation.bind(null, companySlug);
  return (
    <main className="min-h-screen bg-slate-50 p-5">
      <div className="mx-auto max-w-5xl space-y-5">
        <Button asChild variant="outline"><Link href={`/portal/${companySlug}/requests`}>Back to requests</Link></Button>
        <Card>
          <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>{request.requestNo}</CardTitle><CardDescription>{request.originCountry} to {request.destinationCountry}</CardDescription></div><Badge variant="secondary">{request.status.replaceAll("_", " ")}</Badge></div></CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <p>Shipment: {request.shipmentType}</p>
            <p>Mode: {request.transportMode}</p>
            <p>Scope: {request.serviceScope.replaceAll("_", " ")}</p>
            <p>Pickup: {request.pickupAddress ?? "-"}</p>
            <p>Delivery: {request.deliveryAddress ?? "-"}</p>
            <p>Reference: {request.customerReference ?? "-"}</p>
            <p className="md:col-span-3">Cargo: {request.cargoDescription}</p>
            <p className="md:col-span-3">Your notes: {request.customerNotes ?? "-"}</p>
          </CardContent>
        </Card>
        {request.convertedShipmentJobId ? <Card><CardContent className="flex items-center justify-between gap-3 p-5"><div><p className="font-semibold">Shipment tracking available</p><p className="text-sm text-slate-500">This request has been converted to an active shipment.</p></div><Button asChild><Link href={`/portal/${companySlug}/shipments/${request.convertedShipmentJobId}`}>Track shipment</Link></Button></CardContent></Card> : null}
        {customerVisible ? (
          <Card>
            <CardHeader><CardTitle>Quotation {customerVisible.quoteNo}</CardTitle><CardDescription>Customer proposal · {customerVisible.status}</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/portal/${companySlug}/quotations/${customerVisible.id}`}>Open quotation</Link></Button><Button asChild variant="outline"><Link href={`/portal/${companySlug}/quotations/${customerVisible.id}/print`}>Print</Link></Button><Button asChild><a download href={`/api/portal/${companySlug}/quotations/${customerVisible.id}/pdf`}>Download PDF</a></Button></div>
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Charge</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Sell rate</th><th className="px-4 py-3">Amount</th></tr></thead><tbody className="divide-y divide-slate-200">{customerVisible.charges.map((charge) => <tr key={charge.id}><td className="px-4 py-3">{charge.chargeName}</td><td className="px-4 py-3">{String(charge.quantity)}</td><td className="px-4 py-3">{charge.currency} {Number(charge.sellRate).toFixed(2)}</td><td className="px-4 py-3">{charge.currency} {Number(charge.sellAmount).toFixed(2)}</td></tr>)}</tbody></table>
              </div>
              <p className="text-xl font-semibold">Proposal total: {money(customerVisible.totalSellAmount)}</p>
              {customerVisible.status === "SENT" && request.status === "QUOTED" ? <PortalQuotationResponseForm action={responseAction} shipmentRequestId={request.id} quotationId={customerVisible.id} /> : null}
            </CardContent>
          </Card>
        ) : <Card><CardContent className="p-6 text-sm text-slate-500">A customer-facing quotation is not available yet.</CardContent></Card>}
      </div>
    </main>
  );
}
