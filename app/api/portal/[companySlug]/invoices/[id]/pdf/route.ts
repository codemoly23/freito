import { NextResponse } from "next/server";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalInvoiceData } from "@/lib/client-portal/data";
import { generateInvoicePdf } from "@/lib/pdf/invoice-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const invoice = await getPortalInvoiceData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!invoice) return new NextResponse("Not found", { status: 404 });
  const pdf = await generateInvoicePdf(invoice);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.invoiceNo}.pdf"`, "Cache-Control": "private, no-store" } });
}
