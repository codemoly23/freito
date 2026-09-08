import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { calculateDocumentCompliance } from "@/lib/documents/engine";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Check, X, ShieldAlert, TrendingUp } from "lucide-react";

export default async function DocumentComplianceReportPage() {
  const user = await requirePermission("reports:view");

  const shipments = await prisma.shipmentjob.findMany({
    where: { 
      companyId: user.companyId ?? "",
      deletedAt: null 
    },
    include: {
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const complianceData = await Promise.all(
    shipments.map(async (shipment) => {
      const metrics = await calculateDocumentCompliance(shipment.id, user.companyId);
      return {
        id: shipment.id,
        bookingNo: shipment.bookingNo,
        customerName: shipment.customer?.name || "N/A",
        shipmentType: shipment.shipmentType,
        transportMode: shipment.transportMode,
        tradeTerm: shipment.tradeTerm || "N/A",
        origin: shipment.originCountry,
        destination: shipment.destinationCountry,
        metrics,
      };
    })
  );

  // Compute aggregate stats
  const totalShipments = complianceData.length;
  const avgCompletion = totalShipments > 0 
    ? Math.round(complianceData.reduce((acc, d) => acc + d.metrics.completionPercent, 0) / totalShipments)
    : 0;

  const fullyCompliant = complianceData.filter(d => d.metrics.requiredRemaining === 0).length;
  const pendingCompliance = totalShipments - fullyCompliant;

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shipment Document Compliance Report</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor real-time document compliance levels, pending uploads, and blocker gates across all active shipments.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="bg-slate-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Active Jobs</CardDescription>
            <CardTitle className="text-2xl text-slate-800 font-bold">{totalShipments}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-slate-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Compliance Rate</CardDescription>
            <CardTitle className="text-2xl text-emerald-700 font-bold flex items-center gap-1.5">
              <TrendingUp className="h-5 w-5" /> {avgCompletion}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-slate-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fully Compliant</CardDescription>
            <CardTitle className="text-2xl text-emerald-700 font-bold">{fullyCompliant}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-slate-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Actions</CardDescription>
            <CardTitle className="text-2xl text-amber-600 font-bold">{pendingCompliance}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Status Breakdown</CardTitle>
          <CardDescription>
            Detailed checklist fulfillment metrics and operational readiness gates per active shipment job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white">
            <table className="min-w-full divide-y divide-slate-100 text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">Shipment Ref</th>
                  <th className="px-6 py-3">Trade & Mode</th>
                  <th className="px-6 py-3">Fulfillment Rate</th>
                  <th className="px-6 py-3">Docs (Remaining)</th>
                  <th className="px-6 py-3">Readiness Gates</th>
                  <th className="px-6 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-solid">
                {complianceData.map((data) => (
                  <tr key={data.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800">{data.bookingNo}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{data.customerName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">{data.shipmentType} ({data.tradeTerm})</div>
                      <div className="text-xs text-slate-500 mt-0.5">{data.transportMode} • {data.origin} → {data.destination}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              data.metrics.completionPercent === 100 
                                ? "bg-emerald-600" 
                                : data.metrics.completionPercent > 50 
                                ? "bg-amber-500" 
                                : "bg-red-500"
                            }`} 
                            style={{ width: `${data.metrics.completionPercent}%` }} 
                          />
                        </div>
                        <span className="font-semibold text-slate-800">{data.metrics.completionPercent}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700">
                        {data.metrics.uploadedCount} / {data.metrics.totalCount} uploaded
                      </div>
                      {data.metrics.requiredRemaining > 0 ? (
                        <div className="text-xs text-red-500 font-semibold mt-0.5">
                          {data.metrics.requiredRemaining} mandatory document(s) missing
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-600 font-semibold mt-0.5">
                          All mandatory documents uploaded
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 text-[11px] font-semibold">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                          data.metrics.readyForDelivery ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {data.metrics.readyForDelivery ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} DO
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                          data.metrics.readyForCustoms ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {data.metrics.readyForCustoms ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} Customs
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                          data.metrics.readyForFinance ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {data.metrics.readyForFinance ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} Finance
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                          data.metrics.readyForClose ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          {data.metrics.readyForClose ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} Close
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/dashboard/shipments/${data.id}`}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        View Job
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
