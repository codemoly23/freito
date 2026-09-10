import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricGrid, ReportFilters, ReportHeader, ReportTable } from "@/components/reports/report-ui";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";
import { enumParam, firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { reportDate, statusLabel } from "@/lib/reports/formatters";
import { getDocumentStatusSummary } from "@/lib/reports/document-summary";
import { getFreightDocumentReportRows, getShipmentChecklistDocumentReportRows } from "@/lib/reports/document-list";

const statuses = ["PENDING", "UPLOADED", "VERIFIED", "REJECTED"] as const;

export default async function DocumentsReportPage({ searchParams }: { searchParams: Promise<ReportSearchParams> }) {
  const { user, companyId, branchWhere } = await requireReportsPage("documents");
  const params = await searchParams;
  const range = getReportDateRange(params);
  const status = enumParam(params.status, statuses);
  const shipmentJobId = firstParam(params.shipmentJobId);
  const customerId = firstParam(params.customerId);
  const canExportCsv = hasPermission(user, "exports:csv");
  const [documents, freightDocuments, shipments, customers, checklist, summary] = await Promise.all([
    getShipmentChecklistDocumentReportRows(params),
    getFreightDocumentReportRows(params),
    prisma.shipmentjob.findMany({
      where: { companyId, deletedAt: null, ...branchWhere, ...(customerId ? { customerId } : {}) },
      select: { id: true, jobNo: true, shipmentType: true, customer: { select: { name: true } }, shipmentdocument: { where: { deletedAt: null }, select: { checklistItemId: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.customer.findMany({ where: { companyId, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.documentchecklistitem.findMany({
      where: { isActive: true, isRequired: true, OR: [{ companyId: null }, { companyId }] },
      select: { id: true, name: true, category: true },
    }),
    getDocumentStatusSummary(params),
  ]);
  const missing = shipments.map((shipment) => {
    const present = new Set(shipment.shipmentdocument.map((document) => document.checklistItemId).filter(Boolean));
    const names = checklist.filter((item) => (item.category === shipment.shipmentType || item.category === "COMMON") && !present.has(item.id)).map((item) => item.name);
    return { shipment, names };
  }).filter((item) => item.names.length);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <ReportHeader title="Document Report" description="Missing, verified, rejected, and client-visible freight documents." />
      <ReportFilters from={range.fromInput} to={range.toInput}>
        <select aria-label="Document status" name="status" defaultValue={status ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
        <select aria-label="Shipment" name="shipmentJobId" defaultValue={shipmentJobId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All shipments</option>{shipments.map((shipment) => <option value={shipment.id} key={shipment.id}>{shipment.jobNo}</option>)}</select>
        <select aria-label="Customer" name="customerId" defaultValue={customerId ?? ""} className="h-10 rounded-md border border-slate-200 px-3 text-sm"><option value="">All customers</option>{customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select>
      </ReportFilters>
      <MetricGrid metrics={[
        { label: "Total documents", value: summary.totalDocuments },
        { label: "Verified documents", value: summary.verifiedDocuments },
        { label: "Rejected documents", value: summary.rejectedDocuments },
        { label: "Client visible documents", value: summary.clientVisibleDocuments },
        { label: "Missing documents", value: summary.missingDocumentCount },
        { label: "HBL count", value: summary.hblCount },
        { label: "HAWB count", value: summary.hawbCount },
        { label: "Manifest count", value: summary.manifestCount },
        { label: "Customer Debit Note count", value: summary.customerDebitNoteCount },
      ]} />
      {canExportCsv ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline">
            <a
              download
              href={`/api/exports/reports/documents?type=freight&from=${range.fromInput}&to=${range.toInput}${shipmentJobId ? `&shipmentJobId=${encodeURIComponent(shipmentJobId)}` : ""}${customerId ? `&customerId=${encodeURIComponent(customerId)}` : ""}`}
            >
              Download CSV
            </a>
          </Button>
        </div>
      ) : null}
      <ReportTable title="Freight document status table" headers={["Document Type", "Document No / Reference", "Job / File No", "Customer", "Status", "Visible to Client", "Responsibility / Handling", "Created Date", "Updated Date", "Open Record"]} empty="No freight documents found for the selected filters." rows={freightDocuments.map((document) => [
        statusLabel(document.type),
        document.documentNo || document.referenceNo || "-",
        document.shipmentjob.jobNo,
        document.shipmentjob.customer.name,
        <Badge variant={document.status === "REJECTED" ? "danger" : "secondary"} key="status">{statusLabel(document.status)}</Badge>,
        document.isClientVisible ? "Yes" : "No",
        `${statusLabel(document.responsibility)} / ${statusLabel(document.handlingMode)}`,
        reportDate(document.createdAt),
        reportDate(document.updatedAt),
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${document.shipmentjob.id}/freight-documents/${document.id}`}>View</Link></Button>,
      ])} />
      {canExportCsv ? (
        <div className="flex justify-end">
          <Button asChild size="sm" variant="outline">
            <a
              download
              href={`/api/exports/reports/documents?type=checklist&from=${range.fromInput}&to=${range.toInput}${status ? `&status=${encodeURIComponent(status)}` : ""}${shipmentJobId ? `&shipmentJobId=${encodeURIComponent(shipmentJobId)}` : ""}${customerId ? `&customerId=${encodeURIComponent(customerId)}` : ""}`}
            >
              Download CSV
            </a>
          </Button>
        </div>
      ) : null}
      <ReportTable title="Shipment document checklist table" headers={["Document Type", "Document Name / Reference", "Job / File No", "Customer", "Status", "Visible to Client", "Responsibility / Handling", "Created Date", "Updated Date", "Open Record"]} empty="No uploaded shipment checklist documents found for this period." rows={documents.map((document) => [
        document.documentType,
        document.documentName,
        document.shipmentjob.jobNo,
        document.shipmentjob.customer.name,
        <Badge variant={document.status === "REJECTED" ? "danger" : "secondary"} key="status">{statusLabel(document.status)}</Badge>,
        "-",
        "Shipment checklist / Upload",
        reportDate(document.createdAt),
        reportDate(document.updatedAt),
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${document.shipmentjob.id}#documents`}>View</Link></Button>,
      ])} />
      <ReportTable title="Shipments with missing required documents" headers={["Job / File No", "Customer", "Missing Count", "Missing Documents", "Open Record"]} empty="No document issues found for this period." rows={missing.slice(0, 30).map(({ shipment, names }) => [
        shipment.jobNo,
        shipment.customer.name,
        names.length,
        names.slice(0, 4).join(", ") + (names.length > 4 ? ` +${names.length - 4}` : ""),
        <Button asChild size="sm" variant="outline" key="view"><Link href={`/dashboard/shipments/${shipment.id}`}>View</Link></Button>,
      ])} />
    </main>
  );
}
