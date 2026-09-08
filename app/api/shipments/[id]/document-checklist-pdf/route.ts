import { generateDocumentChecklistPdf } from "@/lib/pdf/shipment-pdf";
import { authorizeExport } from "@/lib/print/access";
import { getDocumentChecklistExportData } from "@/lib/print/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeExport("exports:pdf", "DOCUMENTS");
  if (!access.ok) return new Response("Unauthorized", { status: access.status });
  const { id } = await params;
  const data = await getDocumentChecklistExportData(id, access.companyId);
  if (!data) return new Response("Not found", { status: 404 });
  const pdf = await generateDocumentChecklistPdf(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${data.shipment.jobNo}-document-checklist.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
