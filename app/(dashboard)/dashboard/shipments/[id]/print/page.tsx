import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDetails, PrintLayout, PrintSection, PrintTable } from "@/components/print/print-layout";
import { requireModuleAccess } from "@/lib/access/company-access";
import { formatDate, formatValue } from "@/lib/pdf/formatters";
import { requirePermission } from "@/lib/permissions/rbac";
import { getShipmentExportData } from "@/lib/print/data";

export const metadata: Metadata = { title: "Print Shipment Summary" };

export default async function ShipmentPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("exports:print");
  await requireModuleAccess(user.companyId, "SHIPMENTS");
  const { id } = await params;
  const shipment = await getShipmentExportData(id, user.companyId ?? "");
  if (!shipment) notFound();
  return <PrintLayout title="Shipment Summary" documentNo={shipment.jobNo} status={shipment.currentStatus} company={shipment.company} logoUrl={shipment.company.logoPath ? "/api/company/branding/logo" : null} pdfUrl={`/api/shipments/${shipment.id}/summary-pdf`}>
    <PrintSection title="Shipment overview"><PrintDetails items={[
      ["Customer", shipment.customer.name],
      ["Service", `${shipment.shipmentType} / ${shipment.transportMode} / ${shipment.serviceScope}`],
      ["Route", `${shipment.originCountry} / ${formatValue(shipment.originPort)} to ${shipment.destinationCountry} / ${formatValue(shipment.destinationPort)}`],
      ["ETD", formatDate(shipment.etd)],
      ["ETA", formatDate(shipment.eta)],
      ["Booking", formatValue(shipment.bookingNo)],
      ["Carrier", formatValue(shipment.carrierName ?? shipment.shippingLineOrAirline)],
      ["Packages", `${formatValue(shipment.packageCount)} ${formatValue(shipment.packageType)}`],
    ]} /></PrintSection>
    <PrintSection title="Cargo"><p className="whitespace-pre-wrap text-sm">{shipment.cargoDescription}</p></PrintSection>
    <PrintSection title="Containers"><PrintTable headers={["Container", "Type", "Seal", "Packages", "CBM"]} rows={shipment.containers.map((container) => [
      container.containerNo,
      formatValue(container.containerType),
      formatValue(container.sealNo),
      formatValue(container.packageCount),
      formatValue(container.cbm),
    ])} /></PrintSection>
    <PrintSection title="Customer-visible milestones"><PrintTable headers={["Milestone", "Status", "Date"]} rows={shipment.workflowSteps.map((step) => [
      step.title,
      step.status,
      formatDate(step.completedAt ?? step.dueDate),
    ])} /></PrintSection>
  </PrintLayout>;
}
