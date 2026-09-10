import Link from "next/link";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/pdf/formatters";
import { Calendar, CheckCircle2, Clock, Send } from "lucide-react";

export default async function CarrierQueriesPage() {
  const user = await requirePermission("carrierQueries:list");
  await requireModuleAccess(user.companyId!, "SHIPMENT_OPERATIONS");
  const queries = await prisma.carrierquery.findMany({
    where: { companyId: user.companyId!, deletedAt: null },
    include: {
      vendor: true,
      shipmentrequest: true,
      shipmentjob: true,
      carrierproposal: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      _count: { select: { carrierproposal: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Carrier Queries</h1>
          <p className="text-sm text-slate-500">Shipment-wise buying queries, log timestamps, and provider proposals.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/carrier-queries/new">New carrier query</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buying query register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {queries.map((q) => {
            const acceptedProposal = q.carrierproposal.find((p) => p.selected);
            const acceptedAt = q.status === "SELECTED" ? (acceptedProposal?.updatedAt ?? q.updatedAt) : null;
            const latestProposalAt = q.carrierproposal[0]?.createdAt;

            return (
              <Link
                key={q.id}
                href={`/dashboard/carrier-queries/${q.id}`}
                className="grid gap-3 rounded-lg border p-4 transition-colors hover:bg-slate-50 md:grid-cols-12 md:items-center"
              >
                <div className="md:col-span-3">
                  <p className="font-semibold text-slate-900">{q.shipmentrequest?.requestNo ?? q.shipmentjob?.jobNo ?? "Direct Query"}</p>
                  <p className="text-xs text-slate-500">{q.vendor.name}</p>
                </div>

                <div className="md:col-span-3">
                  <p className="text-sm text-slate-700">{q.origin} → {q.destination}</p>
                  <span className="text-xs text-slate-500">Mode: {q.mode}</span>
                </div>

                <div className="md:col-span-2">
                  <Badge variant={q.status === "SELECTED" ? "success" : q.status === "SENT" ? "default" : "secondary"}>
                    {q.status}
                  </Badge>
                  <p className="mt-1 text-xs text-slate-500">{q._count.carrierproposal} proposal(s)</p>
                </div>

                <div className="space-y-1 text-xs text-slate-600 md:col-span-4 md:border-l md:pl-4">
                  <div className="flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-blue-500" />
                    <span><b>Submitted / Sent:</b> {formatDateTime(q.querySentAt ?? q.createdAt)}</span>
                  </div>
                  {latestProposalAt && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                      <span><b>Latest Proposal:</b> {formatDateTime(latestProposalAt)}</span>
                    </div>
                  )}
                  {acceptedAt ? (
                    <div className="flex items-center gap-1.5 font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span><b>Accepted:</b> {formatDateTime(acceptedAt)}</span>
                    </div>
                  ) : q.responseDueAt ? (
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span><b>Due Date:</b> {formatDate(q.responseDueAt)}</span>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
          {!queries.length ? <p className="text-sm text-slate-500">No carrier queries yet.</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
