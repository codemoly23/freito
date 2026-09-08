import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDetails, PrintLayout, PrintSection, PrintTable } from "@/components/print/print-layout";
import { requireModuleAccess } from "@/lib/access/company-access";
import { formatDate, formatMoney, formatValue } from "@/lib/pdf/formatters";
import { requirePermission } from "@/lib/permissions/rbac";
import { getQuotationExportData } from "@/lib/print/data";

export const metadata: Metadata = { title: "Print Quotation" };

export default async function QuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("exports:print");
  await requireModuleAccess(user.companyId, "QUOTATIONS");
  const { id } = await params;
  const quotation = await getQuotationExportData(id, user.companyId ?? "");
  if (!quotation) notFound();
  return <PrintLayout title="Quotation" documentNo={quotation.quoteNo} status={quotation.status} company={quotation.company} logoUrl={quotation.company.logoPath ? "/api/company/branding/logo" : null} pdfUrl={`/api/quotations/${quotation.id}/pdf`}>
    <PrintSection title="Quotation details"><PrintDetails items={[
      ["Date", formatDate(quotation.createdAt)],
      ["Valid until", formatDate(quotation.validUntil)],
      ["Customer", quotation.customer.name],
      ["Contact", [quotation.customer.email, quotation.customer.phone].filter(Boolean).join(" | ")],
      ["Reference", quotation.shipmentRequest?.customerReference ?? quotation.shipmentRequest?.requestNo ?? quotation.shipmentJob?.jobNo ?? "-"],
      ["Route", `${formatValue(quotation.originCountry)} / ${formatValue(quotation.originPort)} to ${formatValue(quotation.destinationCountry)} / ${formatValue(quotation.destinationPort)}`],
      ["Service", [quotation.shipmentType, quotation.transportMode, quotation.loadType, quotation.tradeTerm].filter(Boolean).join(" / ")],
      ["Prepared by", quotation.createdBy.name],
    ]} /></PrintSection>
    <PrintSection title="Cargo"><p className="whitespace-pre-wrap text-sm">{quotation.cargoDescription ?? "-"}</p></PrintSection>
    <PrintSection title="Charges"><PrintTable headers={["Charge", "Basis", "Quantity", "Sell rate", "Amount"]} rows={quotation.charges.map((charge) => [
      charge.chargeName,
      `${charge.chargeType} / ${charge.chargeBasis}`,
      String(charge.quantity),
      formatMoney(charge.sellRate, charge.currency),
      formatMoney(charge.sellAmount, charge.currency),
    ])} /></PrintSection>
    <PrintSection title="Total"><p className="text-right text-xl font-bold">{formatMoney(quotation.totalSellAmount)}</p></PrintSection>
    <PrintSection title="Customer notes and terms"><p className="whitespace-pre-wrap text-sm">{quotation.remarks ?? "Rates are subject to the stated validity and operational availability."}</p></PrintSection>
  </PrintLayout>;
}
