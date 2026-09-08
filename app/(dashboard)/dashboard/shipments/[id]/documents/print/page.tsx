import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintDetails, PrintLayout, PrintSection, PrintTable } from "@/components/print/print-layout";
import { requireModuleAccess } from "@/lib/access/company-access";
import { requirePermission } from "@/lib/permissions/rbac";
import { getDocumentChecklistExportData } from "@/lib/print/data";

export const metadata: Metadata = { title: "Print Document Checklist" };

export default async function DocumentChecklistPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("exports:print");
  await requireModuleAccess(user.companyId, "DOCUMENTS");
  const { id } = await params;
  const data = await getDocumentChecklistExportData(id, user.companyId ?? "");
  if (!data) notFound();
  return <PrintLayout title="Document Checklist" documentNo={data.shipment.jobNo} company={data.shipment.company} logoUrl={data.shipment.company.logoPath ? "/api/company/branding/logo" : null} pdfUrl={`/api/shipments/${data.shipment.id}/document-checklist-pdf`}>
    <PrintSection title="Shipment"><PrintDetails items={[
      ["Customer", data.shipment.customer.name],
      ["Route", `${data.shipment.originCountry} to ${data.shipment.destinationCountry}`],
      ["Service", `${data.shipment.shipmentType} / ${data.shipment.transportMode}`],
    ]} /></PrintSection>
    <PrintSection title="Required documents"><PrintTable headers={["Document", "Required", "Status"]} rows={data.items.map((item) => [
      item.name,
      item.isRequired ? "Yes" : "No",
      item.status,
    ])} /></PrintSection>
  </PrintLayout>;
}
