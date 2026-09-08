import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { params: Promise<{ companySlug: string }> };

export default async function PortalRequestsPage({ params }: PageProps) {
  const { companySlug } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const rawRequests = await prisma.shipmentrequest.findMany({
    where: {
      companyId: account.companyId,
      customerId: account.customerId,
      clientPortalAccountId: account.id,
      deletedAt: null,
    },
    include: {
      quotation: {
        where: { deletedAt: null },
        select: { id: true, quoteNo: true, status: true, totalSellAmount: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const requests = rawRequests.map((r) => ({
    ...r,
    quotations: r.quotation,
  }));
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div><p className="text-sm text-cyan-300">Client Portal</p><h1 className="text-2xl font-semibold">Shipment Requests</h1></div>
          <Button asChild><Link href={`/portal/${companySlug}/requests/new`}><Plus className="h-4 w-4" />New request</Link></Button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl space-y-4 p-5">
        <Button asChild variant="outline"><Link href={`/portal/${companySlug}`}>Portal home</Link></Button>
        <Card>
          <CardHeader><CardTitle>Your requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {requests.map((request) => (
              <Link key={request.id} href={`/portal/${companySlug}/requests/${request.id}`} className="block rounded-md border border-slate-200 p-4 hover:bg-slate-50">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div><p className="font-medium">{request.requestNo}</p><p className="text-sm text-slate-500">{request.originCountry} → {request.destinationCountry} · {request.serviceScope.replaceAll("_", " ")}</p></div>
                  <div className="flex items-center gap-2"><Badge variant="secondary">{request.status.replaceAll("_", " ")}</Badge>{request.quotations[0] && ["SENT", "ACCEPTED", "REJECTED", "CONVERTED"].includes(request.quotations[0].status) ? <Badge variant="warning">{request.quotations[0].quoteNo}</Badge> : null}</div>
                </div>
              </Link>
            ))}
            {!requests.length ? <p className="py-8 text-center text-sm text-slate-500">No shipment requests yet.</p> : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
