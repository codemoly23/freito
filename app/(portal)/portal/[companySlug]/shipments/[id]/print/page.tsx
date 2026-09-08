import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDetails, PrintLayout, PrintSection, PrintTable } from "@/components/print/print-layout";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalShipmentData } from "@/lib/client-portal/data";
import { formatDate, formatValue } from "@/lib/pdf/formatters";

export const metadata: Metadata = { title: "Print Portal Shipment Summary" };

export default async function PortalShipmentPrintPage({ params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const shipment = await getPortalShipmentData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!shipment) notFound();
  return <PrintLayout title="Shipment Summary" documentNo={shipment.jobNo} status={shipment.currentStatus} company={shipment.company} logoUrl={shipment.company.logoPath ? `/api/portal/${companySlug}/branding/logo` : null} pdfUrl={`/api/portal/${companySlug}/shipments/${shipment.id}/summary-pdf`}>
    <PrintSection title="Shipment overview"><PrintDetails items={[
      ["Customer", shipment.customer.name], ["Service", `${shipment.shipmentType} / ${shipment.transportMode} / ${shipment.serviceScope}`],
      ["Route", `${shipment.originCountry} / ${formatValue(shipment.originPort)} to ${shipment.destinationCountry} / ${formatValue(shipment.destinationPort)}`],
      ["ETD", formatDate(shipment.etd)], ["ETA", formatDate(shipment.eta)], ["Booking", formatValue(shipment.bookingNo)],
    ]} /></PrintSection>
    <PrintSection title="Cargo"><p className="text-sm">{shipment.cargoDescription}</p></PrintSection>
    <PrintSection title="Containers"><PrintTable headers={["Container", "Type", "Seal", "Packages", "CBM"]} rows={shipment.containers.map((container) => [container.containerNo, formatValue(container.containerType), formatValue(container.sealNo), formatValue(container.packageCount), formatValue(container.cbm)])} /></PrintSection>
    <PrintSection title="Customer-visible milestones"><PrintTable headers={["Milestone", "Status", "Date"]} rows={shipment.workflowSteps.map((step) => [step.title, step.status, formatDate(step.completedAt ?? step.dueDate)])} /></PrintSection>
  </PrintLayout>;
}
