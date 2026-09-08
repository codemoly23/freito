import { NextResponse } from "next/server";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { getPortalShipmentData } from "@/lib/client-portal/data";
import { generateShipmentSummaryPdf } from "@/lib/pdf/shipment-pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ companySlug: string; id: string }> }) {
  const { companySlug, id } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const shipment = await getPortalShipmentData(id, { companyId: account.companyId, customerId: account.customerId, accountId: account.id });
  if (!shipment) return new NextResponse("Not found", { status: 404 });
  const pdf = await generateShipmentSummaryPdf(shipment);
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${shipment.jobNo}-summary.pdf"`, "Cache-Control": "private, no-store" } });
}
