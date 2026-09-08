import { notFound } from "next/navigation";
import { addCarrierProposal, selectCarrierProposal } from "@/lib/actions/freight-operations";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/pdf/formatters";
import { Calendar, CheckCircle2, Clock, History, Send, User } from "lucide-react";

export default async function CarrierQueryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("carrierQueries:view");
  await requireModuleAccess(user.companyId!, "SHIPMENT_OPERATIONS");
  const { id } = await params;

  const query = await prisma.carrierquery.findFirst({
    where: { id, companyId: user.companyId!, deletedAt: null },
    include: {
      vendor: true,
      shipmentrequest: true,
      shipmentjob: true,
      carrierproposal: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!query) notFound();

  const proposals = query.carrierproposal;
  const proposalIds = proposals.map((p) => p.id);
  const auditLogs = await prisma.auditlog.findMany({
    where: {
      companyId: user.companyId!,
      OR: [
        { entityType: "CarrierQuery", entityId: query.id },
        ...(proposalIds.length ? [{ entityType: "CarrierProposal", entityId: { in: proposalIds } }] : []),
      ],
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const selectedProposal = proposals.find((p) => p.selected);
  const acceptedAt = query.status === "SELECTED" ? (selectedProposal?.updatedAt ?? query.updatedAt) : null;

  const field = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none";

  const timelineSteps = [
    {
      title: "Query Created / Submitted",
      date: query.createdAt,
      formatted: formatDateTime(query.createdAt),
      status: "COMPLETED",
      description: `Query initialized for ${query.vendor.name}`,
      icon: Send,
    },
    {
      title: "RFQ Sent to Carrier",
      date: query.querySentAt,
      formatted: query.querySentAt ? formatDateTime(query.querySentAt) : "Not Sent (Draft)",
      status: query.querySentAt ? "COMPLETED" : "PENDING",
      description: query.querySentAt ? "Sent via email / RFQ system" : "Draft status",
      icon: Send,
    },
    {
      title: "Response Due Date",
      date: query.responseDueAt,
      formatted: query.responseDueAt ? formatDate(query.responseDueAt) : "No due date set",
      status: query.responseDueAt ? "INFO" : "OPTIONAL",
      description: "Expected response deadline from carrier",
      icon: Calendar,
    },
    {
      title: "Carrier Proposal Received",
      date: proposals[0]?.createdAt,
      formatted: proposals.length
        ? `${proposals.length} proposal(s) received (Latest: ${formatDateTime(proposals[0].createdAt)})`
        : "Awaiting proposal",
      status: proposals.length ? "COMPLETED" : "PENDING",
      description: proposals.length ? "Quotations recorded in system" : "No proposals submitted yet",
      icon: Clock,
    },
    {
      title: "Carrier Query Accepted / Selected",
      date: acceptedAt,
      formatted: acceptedAt ? formatDateTime(acceptedAt) : "Not accepted yet",
      status: query.status === "SELECTED" ? "ACCEPTED" : "PENDING",
      description: selectedProposal
        ? `Proposal accepted (${selectedProposal.currency} ${Number(selectedProposal.buyingFreightAmount).toLocaleString()})`
        : "Pending selection",
      icon: CheckCircle2,
    },
  ];

  return (
    <main className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={query.status === "SELECTED" ? "success" : query.status === "SENT" ? "default" : "secondary"}>
              {query.status}
            </Badge>
            <span className="text-xs text-slate-500">Ref: {query.id.slice(-8)}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {query.shipmentrequest?.requestNo ?? query.shipmentjob?.jobNo ?? "Carrier Query"} · {query.vendor.name}
          </h1>
          <p className="text-sm text-slate-500">
            {query.origin} → {query.destination} ({query.mode})
          </p>
        </div>
      </div>

      {/* Primary Log Dates & Timeline Header Card */}
      <Card className="border-blue-100 bg-slate-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-blue-600" />
            Carrier Query Log Dates & Milestone Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border bg-white p-3 shadow-xs">
              <p className="text-xs font-medium text-slate-500">Query Created Log</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(query.createdAt)}</p>
              <span className="text-[11px] text-slate-400">Creation timestamp</span>
            </div>

            <div className="rounded-lg border bg-white p-3 shadow-xs">
              <p className="text-xs font-medium text-slate-500">Submitted / Sent Date</p>
              <p className="mt-1 text-sm font-semibold text-blue-700">{formatDateTime(query.querySentAt ?? query.createdAt)}</p>
              <span className="text-[11px] text-slate-400">{query.querySentAt ? "RFQ Blast / Email Sent" : "Initial Draft"}</span>
            </div>

            <div className="rounded-lg border bg-white p-3 shadow-xs">
              <p className="text-xs font-medium text-slate-500">Response Due Date</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(query.responseDueAt)}</p>
              <span className="text-[11px] text-slate-400">Carrier due date</span>
            </div>

            <div className="rounded-lg border bg-white p-3 shadow-xs">
              <p className="text-xs font-medium text-slate-500">First Proposal Date</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">
                {proposals.length ? formatDateTime(proposals[proposals.length - 1].createdAt) : "-"}
              </p>
              <span className="text-[11px] text-slate-400">Received timestamp</span>
            </div>

            <div className={`rounded-lg border p-3 shadow-xs ${acceptedAt ? "border-emerald-200 bg-emerald-50/60" : "bg-white"}`}>
              <p className="text-xs font-medium text-slate-500">Accepted Date (Kobe Accept Holo)</p>
              <p className={`mt-1 text-sm font-bold ${acceptedAt ? "text-emerald-700" : "text-slate-400"}`}>
                {acceptedAt ? formatDateTime(acceptedAt) : "Pending Selection"}
              </p>
              <span className="text-[11px] text-slate-500">{acceptedAt ? "Carrier Proposal Selected" : "Not yet accepted"}</span>
            </div>
          </div>

          {/* Visual Step-by-Step Timeline */}
          <div className="mt-6 space-y-3 border-t pt-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status & Audit History</h4>
            <div className="grid gap-3 md:grid-cols-5">
              {timelineSteps.map((step) => {
                const Icon = step.icon;
                const isComplete = step.status === "COMPLETED" || step.status === "ACCEPTED";
                const isAccepted = step.status === "ACCEPTED";

                return (
                  <div
                    key={step.title}
                    className={`relative rounded-md border p-3 text-xs ${
                      isAccepted
                        ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                        : isComplete
                        ? "border-blue-200 bg-blue-50/50 text-slate-900"
                        : "bg-white text-slate-500"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <Icon className={`h-4 w-4 ${isAccepted ? "text-emerald-600" : isComplete ? "text-blue-600" : "text-slate-400"}`} />
                      <span>{step.title}</span>
                    </div>
                    <p className="mt-1 font-semibold text-slate-800">{step.formatted}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cargo Details */}
      <Card>
        <CardHeader>
          <CardTitle>Cargo query details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Transport Mode</p>
            <p className="font-medium">{query.mode}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">HS Code</p>
            <p className="font-medium">{query.hsCode ?? "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Weight / CBM</p>
            <p className="font-medium">
              {query.weight ? `${String(query.weight)} KG` : "-"} / {query.cbm ? `${String(query.cbm)} CBM` : "-"}
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs text-slate-500">Cargo Summary</p>
            <p className="text-sm text-slate-800">{query.cargoSummary || "-"}</p>
          </div>
          {query.notes && (
            <div className="md:col-span-3">
              <p className="text-xs text-slate-500">Notes</p>
              <p className="text-sm text-slate-800">{query.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form to Receive Proposal */}
      {hasPermission(user, "carrierProposals:manage") ? (
        <Card>
          <CardHeader>
            <CardTitle>Receive provider proposal</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addCarrierProposal} className="grid gap-3 md:grid-cols-4">
              <input type="hidden" name="carrierQueryId" value={query.id} />
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Buying freight amount *
                <input required name="buyingFreightAmount" type="number" step="0.01" className={field} placeholder="0.00" />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Local charges
                <input name="localCharges" type="number" step="0.01" className={field} placeholder="0.00" />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Currency
                <select name="currency" className={field}>
                  <option>USD</option>
                  <option>BDT</option>
                  <option>EUR</option>
                  <option>GBP</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Provider reference
                <input name="providerReference" className={field} placeholder="Ref no." />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Validity date
                <input name="validUntil" type="date" className={field} />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Transit time
                <input name="transitTime" className={field} placeholder="e.g. 15-20 days" />
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-700">
                Free time
                <input name="freeTime" className={field} placeholder="e.g. 7 days" />
              </label>
              <div className="flex items-end">
                <Button type="submit">Record proposal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* Proposal List with Received and Accepted Log Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Internal buying proposals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposals.map((p) => {
            const proposalAcceptedAt = p.selected ? (p.updatedAt ?? query.updatedAt) : null;

            return (
              <div
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 transition-colors ${
                  p.selected ? "border-emerald-300 bg-emerald-50/50" : "bg-white"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-900">
                      {p.currency} {Number(p.buyingFreightAmount).toLocaleString()}{" "}
                      <span className="text-xs font-normal text-slate-500">+ {Number(p.localCharges).toLocaleString()} local charges</span>
                    </p>
                    {p.selected && <Badge variant="success">SELECTED</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">
                    {p.providerReference ? `Ref: ${p.providerReference}` : "No reference"} · {p.transitTime ? `Transit: ${p.transitTime}` : "No transit time"} · {p.freeTime ? `Free time: ${p.freeTime}` : ""}
                  </p>

                  {/* Proposal Timestamps */}
                  <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600 pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                      <span><b>Received Log:</b> {formatDateTime(p.createdAt)}</span>
                    </div>
                    {proposalAcceptedAt && (
                      <div className="flex items-center gap-1 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span><b>Accepted Log:</b> {formatDateTime(proposalAcceptedAt)}</span>
                      </div>
                    )}
                    {p.validUntil && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span><b>Valid Until:</b> {formatDate(p.validUntil)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={p.selected ? "success" : "secondary"}>{p.status}</Badge>
                  {hasPermission(user, "carrierProposals:select") && !p.selected ? (
                    <form action={selectCarrierProposal}>
                      <input type="hidden" name="proposalId" value={p.id} />
                      <Button type="submit" variant="outline">
                        Select / Accept
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!proposals.length ? <p className="text-sm text-slate-500">No proposals received yet.</p> : null}
        </CardContent>
      </Card>

      {/* Detailed System Audit Trail Log */}
      {auditLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-slate-600" />
              Detailed Action Log Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="divide-y rounded-md border text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex flex-wrap items-center justify-between p-3 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{log.action.replace(/_/g, " ")}</span>
                    <Badge variant="secondary">{log.entityType}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {log.user?.name ?? log.user?.email ?? "System"}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-slate-700">
                      <Clock className="h-3 w-3 text-slate-400" />
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
