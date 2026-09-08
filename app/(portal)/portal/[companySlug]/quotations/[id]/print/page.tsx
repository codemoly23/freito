import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDetails, PrintLayout, PrintSection, PrintTable } from "@/components/print/print-layout";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalQuotationData } from "@/lib/client-portal/data";
import { formatDate, formatMoney, formatValue } from "@/lib/pdf/formatters";

export const metadata: Metadata = { title: "Print Portal Quotation" };

export default async function PortalQuotationPrintPage({ params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const quotation = await getPortalQuotationData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!quotation) notFound();
  return <PrintLayout title="Quotation" documentNo={quotation.quoteNo} status={quotation.status} company={quotation.company} logoUrl={quotation.company.logoPath ? `/api/portal/${companySlug}/branding/logo` : null} pdfUrl={`/api/portal/${companySlug}/quotations/${quotation.id}/pdf`}>
    <PrintSection title="Quotation details"><PrintDetails items={[
      ["Date", formatDate(quotation.createdAt)], ["Valid until", formatDate(quotation.validUntil)], ["Customer", quotation.customer.name],
      ["Reference", quotation.shipmentRequest?.customerReference ?? quotation.shipmentRequest?.requestNo ?? quotation.shipmentJob?.jobNo ?? "-"],
      ["Route", `${formatValue(quotation.originCountry)} / ${formatValue(quotation.originPort)} to ${formatValue(quotation.destinationCountry)} / ${formatValue(quotation.destinationPort)}`],
      ["Service", [quotation.shipmentType, quotation.transportMode, quotation.loadType, quotation.tradeTerm].filter(Boolean).join(" / ")],
    ]} /></PrintSection>
    <PrintSection title="Cargo"><p className="text-sm">{quotation.cargoDescription ?? "-"}</p></PrintSection>
    <PrintSection title="Charges"><PrintTable headers={["Charge", "Basis", "Quantity", "Sell rate", "Amount"]} rows={quotation.charges.map((charge) => [charge.chargeName, `${charge.chargeType} / ${charge.chargeBasis}`, String(charge.quantity), formatMoney(charge.sellRate, charge.currency), formatMoney(charge.sellAmount, charge.currency)])} /></PrintSection>
    <PrintSection title="Total"><p className="text-right text-xl font-bold">{formatMoney(quotation.totalSellAmount)}</p></PrintSection>
    {quotation.remarks ? <PrintSection title="Terms and notes"><p className="text-sm">{quotation.remarks}</p></PrintSection> : null}
  </PrintLayout>;
}
