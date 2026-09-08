import Link from "next/link";
import { PortalHeader } from "@/components/portal/portal-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/pdf/formatters";

export default async function PortalShipmentsPage({ params }: { params: Promise<{ companySlug: string }> }) {
  const { companySlug } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const [company, shipments] = await Promise.all([
    prisma.company.findUnique({ where: { id: account.companyId }, select: { logoPath: true } }),
    prisma.shipmentjob.findMany({
      where: { companyId: account.companyId, customerId: account.customerId, deletedAt: null, shipmentrequest: { clientPortalAccountId: account.id, deletedAt: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, jobNo: true, shipmentType: true, transportMode: true, originCountry: true, destinationCountry: true, currentStatus: true, etd: true, eta: true },
    }),
  ]);
  return <main className="min-h-screen bg-slate-50">
    <PortalHeader companySlug={companySlug} companyName={account.company.portalDisplayName ?? account.company.name} customerName={account.customer.name} clientCode={account.displayClientCode} hasLogo={Boolean(company?.logoPath)} mustChangePassword={account.mustChangePassword} />
    <section className="mx-auto max-w-6xl space-y-4 p-5"><div><h2 className="text-2xl font-semibold">Shipments</h2><p className="text-sm text-slate-600">Track converted requests, milestones, and required documents.</p></div>
      {shipments.map((shipment) => <Link href={`/portal/${companySlug}/shipments/${shipment.id}`} key={shipment.id}><Card className="hover:bg-slate-50"><CardContent className="grid gap-3 p-5 md:grid-cols-5"><div><p className="font-semibold">{shipment.jobNo}</p><p className="text-xs text-slate-500">{shipment.shipmentType} / {shipment.transportMode}</p></div><p>{shipment.originCountry} to {shipment.destinationCountry}</p><p>ETD {formatDate(shipment.etd)}</p><p>ETA {formatDate(shipment.eta)}</p><Badge className="w-fit" variant="secondary">{shipment.currentStatus ?? "In progress"}</Badge></CardContent></Card></Link>)}
      {!shipments.length ? <p className="rounded-md border border-dashed bg-white p-10 text-center text-sm text-slate-500">No active shipments available.</p> : null}
    </section>
  </main>;
}
