import { generateQuotationPdf } from "@/lib/pdf/quotation-pdf";
import { resolveQuotationTemplateLayout } from "@/lib/pdf/document-template-resolution";
import { authorizeExport } from "@/lib/print/access";
import { getQuotationExportData } from "@/lib/print/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeExport("exports:pdf", "QUOTATIONS");
  if (!access.ok) return new Response("Unauthorized", { status: access.status });
  const { id } = await params;
  const quotation = await getQuotationExportData(id, access.companyId);
  if (!quotation) return new Response("Not found", { status: 404 });
  const layout = await resolveQuotationTemplateLayout(quotation.id, access.companyId, quotation.templateVersionId);
  const pdf = await generateQuotationPdf(quotation, layout);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quotation.quoteNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
