import Link from "next/link";
import { PortalHeader } from "@/components/portal/portal-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";
import { formatDate, formatMoney } from "@/lib/pdf/formatters";

export default async function PortalInvoicesPage({ params }: { params: Promise<{ companySlug: string }> }) {
  const { companySlug } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const [company, invoices] = await Promise.all([
    prisma.company.findUnique({ where: { id: account.companyId }, select: { logoPath: true } }),
    prisma.invoice.findMany({
      where: { companyId: account.companyId, customerId: account.customerId, deletedAt: null, status: { not: "CANCELLED" } },
      orderBy: { invoiceDate: "desc" },
      select: { id: true, invoiceNo: true, invoiceDate: true, dueDate: true, status: true, currency: true, totalAmount: true, paidAmount: true, dueAmount: true, shipmentjob: { select: { jobNo: true } } },
    }),
  ]);
  return <main className="min-h-screen bg-slate-50">
    <PortalHeader companySlug={companySlug} companyName={account.company.portalDisplayName ?? account.company.name} customerName={account.customer.name} clientCode={account.displayClientCode} hasLogo={Boolean(company?.logoPath)} mustChangePassword={account.mustChangePassword} />
    <section className="mx-auto max-w-6xl space-y-4 p-5"><div><h2 className="text-2xl font-semibold">Invoices</h2><p className="text-sm text-slate-600">Your customer invoices and payment balances.</p></div>
      {invoices.map((invoice) => <Link href={`/portal/${companySlug}/invoices/${invoice.id}`} key={invoice.id}><Card className="hover:bg-slate-50"><CardContent className="grid gap-3 p-5 md:grid-cols-5"><div><p className="font-semibold">{invoice.invoiceNo}</p><p className="text-xs text-slate-500">{formatDate(invoice.invoiceDate)}</p></div><p>{invoice.shipmentjob?.jobNo ?? "No job reference"}</p><p>{formatMoney(invoice.totalAmount, invoice.currency)}</p><p>Due: {formatMoney(invoice.dueAmount, invoice.currency)}</p><Badge className="w-fit" variant="secondary">{invoice.status}</Badge></CardContent></Card></Link>)}
      {!invoices.length ? <p className="rounded-md border border-dashed bg-white p-10 text-center text-sm text-slate-500">No invoices available.</p> : null}
    </section>
  </main>;
}
