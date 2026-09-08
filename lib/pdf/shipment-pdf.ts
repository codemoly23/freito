import type { DocumentChecklistExportData, ShipmentExportData } from "@/lib/print/data";
import { formatDate, formatValue } from "@/lib/pdf/formatters";
import { generatePdf } from "@/lib/pdf/pdf-generator";

export function generateShipmentSummaryPdf(shipment: ShipmentExportData) {
  return generatePdf({
    title: "SHIPMENT SUMMARY",
    documentNo: shipment.jobNo,
    status: shipment.currentStatus ?? "In progress",
    companyName: shipment.company.legalName ?? shipment.company.name,
    companyDetails: [shipment.company.address ?? "", shipment.company.email ?? "", shipment.company.phone ?? ""],
    companyLogoPath: shipment.company.logoPath,
    sections: [
      {
        title: "Shipment overview",
        lines: [
          ["Customer", shipment.customer.name],
          ["Service", `${shipment.shipmentType} / ${shipment.transportMode} / ${shipment.serviceScope}`],
          ["Route", `${shipment.originCountry} / ${formatValue(shipment.originPort)} to ${shipment.destinationCountry} / ${formatValue(shipment.destinationPort)}`],
          ["ETD", formatDate(shipment.etd)],
          ["ETA", formatDate(shipment.eta)],
          ["Booking", formatValue(shipment.bookingNo)],
          ["Carrier", formatValue(shipment.carrierName ?? shipment.shippingLineOrAirline)],
        ],
      },
      { title: "Cargo", paragraphs: [shipment.cargoDescription] },
      {
        title: "Cargo details",
        lines: [
          ["Packages", `${formatValue(shipment.packageCount)} ${formatValue(shipment.packageType)}`],
          ["Gross weight", formatValue(shipment.grossWeight)],
          ["Chargeable weight", formatValue(shipment.chargeableWeight)],
          ["CBM", formatValue(shipment.cbm)],
        ],
      },
      {
        title: "Containers",
        table: {
          columns: [
            { label: "Container", width: 150 },
            { label: "Type", width: 95 },
            { label: "Seal", width: 120 },
            { label: "Packages", width: 75, align: "right" },
            { label: "CBM", width: 75, align: "right" },
          ],
          rows: shipment.containers.map((container) => [
            container.containerNo,
            formatValue(container.containerType),
            formatValue(container.sealNo),
            formatValue(container.packageCount),
            formatValue(container.cbm),
          ]),
        },
      },
      {
        title: "Customer-visible milestones",
        table: {
          columns: [
            { label: "Milestone", width: 265 },
            { label: "Status", width: 120 },
            { label: "Date", width: 130 },
          ],
          rows: shipment.workflowSteps.map((step) => [
            step.title,
            step.status,
            formatDate(step.completedAt ?? step.dueDate),
          ]),
        },
      },
    ],
  });
}

export function generateDocumentChecklistPdf(data: DocumentChecklistExportData) {
  return generatePdf({
    title: "DOCUMENT CHECKLIST",
    documentNo: data.shipment.jobNo,
    companyName: data.shipment.company.legalName ?? data.shipment.company.name,
    companyDetails: [data.shipment.company.address ?? "", data.shipment.company.email ?? "", data.shipment.company.phone ?? ""],
    companyLogoPath: data.shipment.company.logoPath,
    sections: [
      {
        title: "Shipment",
        lines: [
          ["Customer", data.shipment.customer.name],
          ["Route", `${data.shipment.originCountry} to ${data.shipment.destinationCountry}`],
          ["Service", `${data.shipment.shipmentType} / ${data.shipment.transportMode}`],
        ],
      },
      {
        title: "Required documents",
        table: {
          columns: [
            { label: "Document", width: 300 },
            { label: "Required", width: 95 },
            { label: "Status", width: 120 },
          ],
          rows: data.items.map((item) => [item.name, item.isRequired ? "Yes" : "No", item.status]),
        },
      },
    ],
  });
}
