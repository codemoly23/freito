import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalQuotationData } from "@/lib/client-portal/data";
import { formatDate, formatValue } from "@/lib/pdf/formatters";
import { QuotationChargesConverter } from "@/components/portal/quotation-charges-converter";

export default async function PortalQuotationPage({ params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const quotation = await getPortalQuotationData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!quotation) notFound();
  const serializedCharges = quotation.charges.map((c) => ({
    chargeName: c.chargeName,
    quantity: Number(c.quantity),
    sellRate: Number(c.sellRate),
    sellAmount: Number(c.sellAmount),
    currency: c.currency,
  }));

  return <main className="min-h-screen bg-slate-50 p-5"><div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap justify-between gap-3">
      <Button asChild variant="outline"><Link href={quotation.shipmentRequest ? `/portal/${companySlug}/requests/${quotation.shipmentRequestId}` : `/portal/${companySlug}`}>Back</Link></Button>
      <div className="flex gap-2"><Button asChild variant="outline"><Link href={`/portal/${companySlug}/quotations/${quotation.id}/print`}>Print</Link></Button><Button asChild><a download href={`/api/portal/${companySlug}/quotations/${quotation.id}/pdf`}>Download PDF</a></Button></div>
    </div>
    <Card><CardHeader><div className="flex justify-between gap-3"><div><CardTitle>{quotation.quoteNo}</CardTitle><p className="text-sm text-slate-500">Valid until {formatDate(quotation.validUntil)}</p></div><Badge variant="secondary">{quotation.status}</Badge></div></CardHeader><CardContent className="grid gap-4 text-sm md:grid-cols-2">
      <p>Customer: {quotation.customer.name}</p><p>Reference: {quotation.shipmentRequest?.customerReference ?? quotation.shipmentRequest?.requestNo ?? quotation.shipmentJob?.jobNo ?? "-"}</p>
      <p>Route: {formatValue(quotation.originCountry)} to {formatValue(quotation.destinationCountry)}</p><p>Service: {[quotation.shipmentType, quotation.transportMode, quotation.loadType].filter(Boolean).join(" / ")}</p>
      <p className="md:col-span-2">Cargo: {quotation.cargoDescription ?? "-"}</p>
    </CardContent></Card>
    <Card>
      <CardContent className="pt-6">
        <QuotationChargesConverter charges={serializedCharges} />
      </CardContent>
    </Card>
    {quotation.remarks ? <Card><CardHeader><CardTitle>Terms and notes</CardTitle></CardHeader><CardContent className="whitespace-pre-wrap text-sm">{quotation.remarks}</CardContent></Card> : null}
  </div></main>;
}
