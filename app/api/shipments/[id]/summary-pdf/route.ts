import { generateShipmentSummaryPdf } from "@/lib/pdf/shipment-pdf";
import { authorizeExport } from "@/lib/print/access";
import { getShipmentExportData } from "@/lib/print/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeExport("exports:pdf", "SHIPMENTS");
  if (!access.ok) return new Response("Unauthorized", { status: access.status });
  const { id } = await params;
  const shipment = await getShipmentExportData(id, access.companyId);
  if (!shipment) return new Response("Not found", { status: 404 });
  const pdf = await generateShipmentSummaryPdf(shipment);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${shipment.jobNo}-summary.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
