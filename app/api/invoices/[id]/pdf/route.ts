import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";
import { resolveInvoiceTemplateLayout } from "@/lib/pdf/document-template-resolution";
import { authorizeExport } from "@/lib/print/access";
import { getInvoiceExportData } from "@/lib/print/data";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorizeExport("exports:pdf", "BILLING");
  if (!access.ok) return new Response("Unauthorized", { status: access.status });
  const { id } = await params;
  const invoice = await getInvoiceExportData(id, access.companyId);
  if (!invoice) return new Response("Not found", { status: 404 });
  const layout = await resolveInvoiceTemplateLayout(invoice.id, access.companyId, invoice.templateVersionId);
  const pdf = await generateInvoicePdf(invoice, layout);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
