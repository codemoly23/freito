import { NextResponse } from "next/server";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalQuotationData } from "@/lib/client-portal/data";
import { generateQuotationPdf } from "@/lib/pdf/quotation-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const quotation = await getPortalQuotationData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!quotation) return new NextResponse("Not found", { status: 404 });
  const pdf = await generateQuotationPdf(quotation);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${quotation.quoteNo}.pdf"`, "Cache-Control": "private, no-store" } });
}
