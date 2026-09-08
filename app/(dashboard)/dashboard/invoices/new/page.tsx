import { saveInvoice } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { requireBillingPage } from "@/lib/billing/page-helpers";
import { InvoiceForm } from "@/components/forms/billing-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewInvoicePage() {
  const { companyId, branchWhere } = await requireBillingPage("invoices:create");
  const [customers, shipments, quotations] = await Promise.all([
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipmentjob.findMany({
      where: { companyId, deletedAt: null, ...branchWhere },
      orderBy: { createdAt: "desc" },
      select: { id: true, jobNo: true, customerId: true },
    }),
    prisma.quotation.findMany({
      where: { companyId, deletedAt: null, ...branchWhere },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        quoteNo: true,
        customerId: true,
        shipmentJobId: true,
        quotationcharge: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: {
            chargeName: true,
            chargeType: true,
            currency: true,
            quantity: true,
            sellRate: true,
            remarks: true,
          },
        },
      },
    }),
  ]);
  const quotationOptions = quotations.map((quotation) => {
    const currency = quotation.quotationcharge[0]?.currency ?? "BDT";
    return {
      id: quotation.id,
      quoteNo: quotation.quoteNo,
      customerId: quotation.customerId,
      shipmentJobId: quotation.shipmentJobId,
      currency,
      lines: quotation.quotationcharge
        .filter((charge) => charge.currency === currency)
        .map((charge) => ({
          description: charge.chargeName,
          chargeType: charge.chargeType,
          quantity: charge.quantity.toString(),
          unitPrice: charge.sellRate.toString(),
          remarks: charge.remarks,
        })),
    };
  });
  return <main className="space-y-6 p-4 lg:p-6"><div><Badge variant="secondary">Phase 6</Badge><h1 className="mt-3 text-2xl font-semibold">Create invoice</h1></div><Card><CardHeader><CardTitle>Invoice details</CardTitle></CardHeader><CardContent><InvoiceForm action={saveInvoice} customers={customers} shipments={shipments} quotations={quotationOptions} /></CardContent></Card></main>;
}
