import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";
import { generateCsv, type CsvColumn } from "@/lib/exports/csv";
import { firstParam, getReportDateRange, type ReportSearchParams } from "@/lib/reports/date-range";
import { reportDate, statusLabel } from "@/lib/reports/formatters";
import { getOperationsShipmentRows } from "@/lib/reports/operations-export";
import { deriveDeliveryStatus, getWorkflowDeliveryRows } from "@/lib/reports/workflow-export";
import { getFreightDocumentReportRows, getShipmentChecklistDocumentReportRows } from "@/lib/reports/document-list";
import { getCustomerPerformanceRows } from "@/lib/reports/customer-summary";
import { getVendorSummaryRows } from "@/lib/reports/vendor-summary";
import { getShipmentRequestsReport } from "@/lib/reports/requests-export";
import { getLinkedJob, getQuotationsReport } from "@/lib/reports/quotations-export";
import {
  agingBucketFor,
  agingBucketLabel,
  bdtAmount,
  filterJobsByProfitStatus,
  getFinancialReportRows,
  outstandingFor,
} from "@/lib/reports/financial-export";

type CsvRow = Record<string, string | number>;

// Matches the plain-rounded-number convention the accounting CSV route
// (app/api/exports/accounting/[report]/route.ts) uses for money cells -- a
// rounded number rather than a currency-formatted string.
function round(value: number) {
  return Math.round(value * 100) / 100;
}
function moneyCell(value: unknown) {
  const number = Number(value ?? 0);
  return number ? round(number) : "";
}

const columns: CsvColumn<CsvRow>[] = [
  { header: "Job / File No", accessor: (r) => r.jobNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Mode", accessor: (r) => r.mode ?? "" },
  { header: "Shipment Type", accessor: (r) => r.shipmentType ?? "" },
  { header: "Load Type", accessor: (r) => r.loadType ?? "" },
  { header: "Service Scope", accessor: (r) => r.serviceScope ?? "" },
  { header: "Status", accessor: (r) => r.status ?? "" },
  { header: "ETD", accessor: (r) => r.etd ?? "" },
  { header: "ETA", accessor: (r) => r.eta ?? "" },
  { header: "Sales Person", accessor: (r) => r.salesPerson ?? "" },
  { header: "Operation Person", accessor: (r) => r.operationPerson ?? "" },
  { header: "Finance Close", accessor: (r) => r.financeClose ?? "" },
  { header: "Created Date", accessor: (r) => r.createdDate ?? "" },
];

const workflowColumns: CsvColumn<CsvRow>[] = [
  { header: "Job / File No", accessor: (r) => r.jobNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Service Scope", accessor: (r) => r.serviceScope ?? "" },
  { header: "Delivery status", accessor: (r) => r.deliveryStatus ?? "" },
  { header: "Delivery Order", accessor: (r) => r.deliveryOrder ?? "" },
  { header: "Gate Pass", accessor: (r) => r.gatePass ?? "" },
  { header: "POD", accessor: (r) => r.pod ?? "" },
  { header: "Cargo Released Date", accessor: (r) => r.cargoReleasedDate ?? "" },
  { header: "Delivered Date", accessor: (r) => r.deliveredDate ?? "" },
  { header: "Closed Date", accessor: (r) => r.closedDate ?? "" },
  { header: "Finance Close", accessor: (r) => r.financeClose ?? "" },
];

const requestColumns: CsvColumn<CsvRow>[] = [
  { header: "Request No", accessor: (r) => r.requestNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Status", accessor: (r) => r.status ?? "" },
  { header: "Transport Mode", accessor: (r) => r.transportMode ?? "" },
  { header: "Service Scope", accessor: (r) => r.serviceScope ?? "" },
  { header: "Created Date", accessor: (r) => r.createdDate ?? "" },
  { header: "Submitted Date", accessor: (r) => r.submittedDate ?? "" },
  { header: "Quoted Date", accessor: (r) => r.quotedDate ?? "" },
  { header: "Accepted Date", accessor: (r) => r.acceptedDate ?? "" },
  { header: "Converted Date", accessor: (r) => r.convertedDate ?? "" },
  { header: "Revision Message", accessor: (r) => r.revisionMessage ?? "" },
  { header: "Quoted Sell Amount", accessor: (r) => r.quotedSellAmount ?? "" },
];

const quotationColumns: CsvColumn<CsvRow>[] = [
  { header: "Quotation No", accessor: (r) => r.quoteNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Status", accessor: (r) => r.status ?? "" },
  { header: "Transport Mode", accessor: (r) => r.transportMode ?? "" },
  { header: "Shipment Type", accessor: (r) => r.shipmentType ?? "" },
  { header: "Quoted Sell Amount", accessor: (r) => r.quotedSellAmount ?? "" },
  { header: "Created Date", accessor: (r) => r.createdDate ?? "" },
  { header: "Valid Until", accessor: (r) => r.validUntil ?? "" },
  { header: "Linked Job/File No", accessor: (r) => r.linkedJobNo ?? "" },
];

// The on-screen tables cap at 100 rows ("Latest 100 matching..."); the CSV
// export isn't meant to be limited the same way, so it asks the shared
// data-fetch functions for a much larger (but still bounded) row count.
const EXPORT_ROW_LIMIT = 5000;

// Same data-fetch function the Shipment Request Report page itself calls
// (with a much higher `take` limit), so the CSV can never drift from what's
// on screen -- see lib/reports/requests-export.ts.
async function buildRequestsCsv(params: ReportSearchParams) {
  const { requests, range } = await getShipmentRequestsReport(params, EXPORT_ROW_LIMIT);
  const rows: CsvRow[] = requests.map((request) => ({
    requestNo: request.requestNo,
    customer: request.customer.name,
    status: request.status,
    transportMode: request.transportMode,
    serviceScope: request.serviceScope,
    createdDate: reportDate(request.createdAt),
    submittedDate: reportDate(request.submittedAt),
    quotedDate: reportDate(request.quotedAt),
    acceptedDate: reportDate(request.acceptedAt),
    convertedDate: reportDate(request.convertedAt),
    revisionMessage: request.revisionMessage ?? "",
    quotedSellAmount: moneyCell(request.quotation[0]?.totalSellAmount),
  }));
  return { rows, columns: requestColumns, range };
}

// Same data-fetch function the Quotation & Sales Report page's "Quotation
// report table" calls (with a much higher `take` limit) -- see
// lib/reports/quotations-export.ts. `getLinkedJob` is the exact same
// linked-job derivation the page uses for its "Linked Job / File" column.
async function buildQuotationsCsv(params: ReportSearchParams) {
  const { quotations, range } = await getQuotationsReport(params, EXPORT_ROW_LIMIT);
  const rows: CsvRow[] = quotations.map((quotation) => ({
    quoteNo: quotation.quoteNo,
    customer: quotation.customer.name,
    status: quotation.status,
    transportMode: quotation.transportMode ?? "",
    shipmentType: quotation.shipmentType ?? "",
    quotedSellAmount: moneyCell(quotation.totalSellAmount),
    createdDate: reportDate(quotation.createdAt),
    validUntil: reportDate(quotation.validUntil),
    linkedJobNo: getLinkedJob(quotation)?.jobNo ?? "",
  }));
  return { rows, columns: quotationColumns, range };
}

async function buildOperationsCsv(params: ReportSearchParams) {
  const { shipments, range } = await getOperationsShipmentRows(params, EXPORT_ROW_LIMIT);
  const rows: CsvRow[] = shipments.map((shipment) => ({
    jobNo: shipment.jobNo,
    customer: shipment.customer.name,
    mode: shipment.transportMode,
    shipmentType: shipment.shipmentType,
    loadType: statusLabel(shipment.loadType),
    serviceScope: statusLabel(shipment.serviceScope),
    status: shipment.currentStatus ?? "Not set",
    etd: reportDate(shipment.etd),
    eta: reportDate(shipment.eta),
    salesPerson: shipment.user_shipmentjob_createdByIdTouser.name,
    operationPerson: shipment.user_shipmentjob_assignedToIdTouser.name,
    financeClose: statusLabel(shipment.financeCloseStatus),
    createdDate: reportDate(shipment.createdAt),
  }));
  return { rows, columns, range };
}

async function buildWorkflowCsv(params: ReportSearchParams) {
  const { deliveryShipments, range } = await getWorkflowDeliveryRows(params, EXPORT_ROW_LIMIT);
  const rows: CsvRow[] = deliveryShipments.map((shipment) => {
    const { checklist, deliveredDate, deliveryStatus, deliveryOrder, gatePass, pod } = deriveDeliveryStatus(shipment);
    return {
      jobNo: shipment.jobNo,
      customer: shipment.customer.name,
      serviceScope: statusLabel(shipment.serviceScope),
      deliveryStatus,
      deliveryOrder,
      gatePass,
      pod,
      cargoReleasedDate: reportDate(checklist?.cargoReleasedAt),
      deliveredDate: reportDate(deliveredDate),
      closedDate: reportDate(shipment.closedAt),
      financeClose: statusLabel(shipment.financeCloseStatus),
    };
  });
  return { rows, columns: workflowColumns, range };
}

const freightDocumentColumns: CsvColumn<CsvRow>[] = [
  { header: "Document Type", accessor: (r) => r.documentType ?? "" },
  { header: "Document No/Reference", accessor: (r) => r.documentNo ?? "" },
  { header: "Job/File No", accessor: (r) => r.jobNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Status", accessor: (r) => r.status ?? "" },
  { header: "Visible to Client", accessor: (r) => r.visibleToClient ?? "" },
  { header: "Responsibility", accessor: (r) => r.responsibility ?? "" },
  { header: "Handling Mode", accessor: (r) => r.handlingMode ?? "" },
  { header: "Created Date", accessor: (r) => r.createdDate ?? "" },
  { header: "Updated Date", accessor: (r) => r.updatedDate ?? "" },
];

const checklistDocumentColumns: CsvColumn<CsvRow>[] = [
  { header: "Document Type", accessor: (r) => r.documentType ?? "" },
  { header: "Document Name", accessor: (r) => r.documentName ?? "" },
  { header: "Job/File No", accessor: (r) => r.jobNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Status", accessor: (r) => r.status ?? "" },
  { header: "Created Date", accessor: (r) => r.createdDate ?? "" },
  { header: "Updated Date", accessor: (r) => r.updatedDate ?? "" },
];

// Same two row-fetch functions the Document Reports page itself calls for
// its "Freight document status table" and "Shipment document checklist
// table" (with a much higher `take` limit) -- see lib/reports/document-list.ts.
// Both sub-reports share the "documents" section key and are selected via
// the `type` query param (defaults to "freight").
async function buildDocumentsCsv(params: ReportSearchParams) {
  const range = getReportDateRange(params);
  if (firstParam(params.type) === "checklist") {
    const documents = await getShipmentChecklistDocumentReportRows(params, EXPORT_ROW_LIMIT);
    const rows: CsvRow[] = documents.map((document) => ({
      documentType: document.documentType,
      documentName: document.documentName,
      jobNo: document.shipmentjob.jobNo,
      customer: document.shipmentjob.customer.name,
      status: statusLabel(document.status),
      createdDate: reportDate(document.createdAt),
      updatedDate: reportDate(document.updatedAt),
    }));
    return { rows, columns: checklistDocumentColumns, range };
  }
  const freightDocuments = await getFreightDocumentReportRows(params, EXPORT_ROW_LIMIT);
  const rows: CsvRow[] = freightDocuments.map((document) => ({
    documentType: statusLabel(document.type),
    documentNo: document.documentNo || document.referenceNo || "",
    jobNo: document.shipmentjob.jobNo,
    customer: document.shipmentjob.customer.name,
    status: statusLabel(document.status),
    visibleToClient: document.isClientVisible ? "Yes" : "No",
    responsibility: statusLabel(document.responsibility),
    handlingMode: statusLabel(document.handlingMode),
    createdDate: reportDate(document.createdAt),
    updatedDate: reportDate(document.updatedAt),
  }));
  return { rows, columns: freightDocumentColumns, range };
}

const customerColumns: CsvColumn<CsvRow>[] = [
  { header: "Customer", accessor: (r) => r.name ?? "" },
  { header: "Shipments", accessor: (r) => r.shipments ?? "" },
  { header: "Quotations", accessor: (r) => r.quotations ?? "" },
  { header: "Quoted Amount", accessor: (r) => r.quotationTotal ?? "" },
  { header: "Acceptance Rate", accessor: (r) => r.acceptance ?? "" },
];

const customerFinancialColumns: CsvColumn<CsvRow>[] = [
  { header: "Invoiced", accessor: (r) => r.invoiced ?? "" },
  { header: "Receivable", accessor: (r) => r.receivable ?? "" },
];

// Same customer-performance aggregation the Customer Reports page's
// "Customer performance" table uses -- see lib/reports/customer-summary.ts.
// `financial` mirrors the page's `reports:financial` gating: the
// Invoiced/Receivable columns are omitted entirely (not just blanked) for a
// user who lacks that permission, matching on-screen behavior exactly.
async function buildCustomersCsv(params: ReportSearchParams) {
  const range = getReportDateRange(params);
  const { rows: customerRows, financial } = await getCustomerPerformanceRows(params);
  const rows: CsvRow[] = customerRows.map((row) => ({
    name: row.name,
    shipments: row.shipments,
    quotations: row.quotations,
    quotationTotal: moneyCell(row.quotationTotal),
    acceptance: `${row.acceptance.toFixed(1)}%`,
    ...(financial ? { invoiced: moneyCell(row.invoiced), receivable: moneyCell(row.receivable) } : {}),
  }));
  const columns = financial ? [...customerColumns, ...customerFinancialColumns] : customerColumns;
  return { rows, columns, range };
}

const vendorColumns: CsvColumn<CsvRow>[] = [
  { header: "Vendor", accessor: (r) => r.name ?? "" },
  { header: "Type", accessor: (r) => r.type ?? "" },
  { header: "Assigned Steps", accessor: (r) => r.assignedSteps ?? "" },
];

const vendorFinancialColumns: CsvColumn<CsvRow>[] = [
  { header: "Bill Amount", accessor: (r) => r.billed ?? "" },
  { header: "Payable Due", accessor: (r) => r.due ?? "" },
];

// Same vendor-summary aggregation the Vendor Reports page's "Vendor
// summary" table uses -- see lib/reports/vendor-summary.ts. `financial`
// mirrors the page's `reports:financial` gating: the Bill Amount/Payable
// Due columns are omitted entirely for a user who lacks that permission.
async function buildVendorsCsv(params: ReportSearchParams) {
  const range = getReportDateRange(params);
  const { rows: vendorRows, financial } = await getVendorSummaryRows(params);
  const rows: CsvRow[] = vendorRows.map((vendor) => ({
    name: vendor.name,
    type: statusLabel(vendor.type),
    assignedSteps: vendor.shipmentworkflowstep.length,
    ...(financial ? { billed: moneyCell(vendor.billed), due: moneyCell(vendor.due) } : {}),
  }));
  const columns = financial ? [...vendorColumns, ...vendorFinancialColumns] : vendorColumns;
  return { rows, columns, range };
}

const financeProfitColumns: CsvColumn<CsvRow>[] = [
  { header: "Job / File No", accessor: (r) => r.jobNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Mode", accessor: (r) => r.mode ?? "" },
  { header: "Shipment Type", accessor: (r) => r.shipmentType ?? "" },
  { header: "Service Scope", accessor: (r) => r.serviceScope ?? "" },
  { header: "Current Sell", accessor: (r) => r.currentSell ?? "" },
  { header: "Current Buy", accessor: (r) => r.currentBuy ?? "" },
  { header: "Current Gross Profit", accessor: (r) => r.currentGrossProfit ?? "" },
  { header: "Current Margin %", accessor: (r) => r.currentMargin ?? "" },
  { header: "Final Sell", accessor: (r) => r.finalSell ?? "" },
  { header: "Final Buy", accessor: (r) => r.finalBuy ?? "" },
  { header: "Final Gross Profit", accessor: (r) => r.finalGrossProfit ?? "" },
  { header: "Final Margin %", accessor: (r) => r.finalMargin ?? "" },
  { header: "Finance Close", accessor: (r) => r.financeClose ?? "" },
  { header: "Locked At", accessor: (r) => r.lockedAt ?? "" },
];

const financeCloseoutColumns: CsvColumn<CsvRow>[] = [
  { header: "Job / File No", accessor: (r) => r.jobNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Operations Status", accessor: (r) => r.operationsStatus ?? "" },
  { header: "Delivery / POD", accessor: (r) => r.deliveryPod ?? "" },
  { header: "Finance Close", accessor: (r) => r.financeClose ?? "" },
  { header: "Close Ready At", accessor: (r) => r.closeReadyAt ?? "" },
  { header: "Locked At", accessor: (r) => r.lockedAt ?? "" },
  { header: "Receivable Outstanding", accessor: (r) => r.receivableOutstanding ?? "" },
  { header: "Payable Outstanding", accessor: (r) => r.payableOutstanding ?? "" },
  { header: "Unpaid Receivable Exception", accessor: (r) => r.unpaidReceivableException ?? "" },
  { header: "Vendor Payables N/A", accessor: (r) => r.vendorPayablesNA ?? "" },
];

const receivableAgingColumns: CsvColumn<CsvRow>[] = [
  { header: "Invoice No", accessor: (r) => r.invoiceNo ?? "" },
  { header: "Customer", accessor: (r) => r.customer ?? "" },
  { header: "Job / File No", accessor: (r) => r.jobNo ?? "" },
  { header: "Invoice Date", accessor: (r) => r.invoiceDate ?? "" },
  { header: "Due Date", accessor: (r) => r.dueDate ?? "" },
  { header: "Invoice Amount", accessor: (r) => r.invoiceAmount ?? "" },
  { header: "Paid Amount", accessor: (r) => r.paidAmount ?? "" },
  { header: "Outstanding Amount", accessor: (r) => r.outstandingAmount ?? "" },
  { header: "Aging Bucket", accessor: (r) => r.agingBucket ?? "" },
  { header: "Status", accessor: (r) => r.status ?? "" },
];

const payableAgingColumns: CsvColumn<CsvRow>[] = [
  { header: "Vendor Bill No", accessor: (r) => r.billNo ?? "" },
  { header: "Vendor", accessor: (r) => r.vendor ?? "" },
  { header: "Job / File No", accessor: (r) => r.jobNo ?? "" },
  { header: "Bill Date", accessor: (r) => r.billDate ?? "" },
  { header: "Due Date", accessor: (r) => r.dueDate ?? "" },
  { header: "Bill Amount", accessor: (r) => r.billAmount ?? "" },
  { header: "Paid Amount", accessor: (r) => r.paidAmount ?? "" },
  { header: "Outstanding Amount", accessor: (r) => r.outstandingAmount ?? "" },
  { header: "Aging Bucket", accessor: (r) => r.agingBucket ?? "" },
  { header: "Status", accessor: (r) => r.status ?? "" },
];

// The Financial Report page has four distinct detailed tables (job-wise
// profit, finance closeout, receivable aging, payable aging), selected here
// via the `report` query param (defaults to "profit") -- same sub-report
// pattern the `documents` section above uses for its `type` param. All four
// read from the exact same `getFinancialReportRows` call and the same pure
// aging/profit-filter helpers the Financial Report page itself uses -- see
// lib/reports/financial-export.ts -- so the CSV can never drift from what's
// on screen for the same filters.
async function buildFinancialCsv(params: ReportSearchParams) {
  const report = firstParam(params.report) ?? "profit";
  const { jobs, invoices, vendorBills, range, agingBucket, profitStatus } = await getFinancialReportRows(params, {
    jobs: EXPORT_ROW_LIMIT,
    invoices: EXPORT_ROW_LIMIT,
    vendorBills: EXPORT_ROW_LIMIT,
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bdt = (row: { exchangeRateToBDT: unknown }, value: unknown) => bdtAmount(row, value);
  const bucketFor = (dueDate: Date | null, fallbackDate: Date) => agingBucketFor(dueDate, fallbackDate, today);

  if (report === "closeout") {
    const filteredJobs = filterJobsByProfitStatus(jobs, profitStatus);
    const rows: CsvRow[] = filteredJobs.map((job) => ({
      jobNo: job.jobNo,
      customer: job.customer.name,
      operationsStatus: job.operationsStatus ?? "",
      deliveryPod: `${job.deliveredAt ? "Delivered" : "Not delivered"} / ${job.proofOfDeliveryAt ? "POD verified" : "POD pending"}`,
      financeClose: statusLabel(job.financeCloseStatus),
      closeReadyAt: reportDate(job.financeCloseReadyAt),
      lockedAt: reportDate(job.financeLockedAt),
      receivableOutstanding: moneyCell(outstandingFor(job.invoice)),
      payableOutstanding: moneyCell(outstandingFor(job.vendorbill)),
      unpaidReceivableException: job.allowUnpaidReceivableClose ? "Yes" : "No",
      vendorPayablesNA: job.vendorPayablesNotApplicable ? "Yes" : "No",
    }));
    return { rows, columns: financeCloseoutColumns, range };
  }

  if (report === "receivables") {
    const filteredInvoices = agingBucket ? invoices.filter((invoice) => bucketFor(invoice.dueDate, invoice.invoiceDate) === agingBucket) : invoices;
    const rows: CsvRow[] = filteredInvoices.map((invoice) => ({
      invoiceNo: invoice.invoiceNo,
      customer: invoice.customer.name,
      jobNo: invoice.shipmentjob?.jobNo ?? "",
      invoiceDate: reportDate(invoice.invoiceDate),
      dueDate: reportDate(invoice.dueDate),
      invoiceAmount: moneyCell(bdt(invoice, invoice.totalAmount)),
      paidAmount: moneyCell(bdt(invoice, invoice.paidAmount)),
      outstandingAmount: moneyCell(bdt(invoice, invoice.dueAmount)),
      agingBucket: agingBucketLabel(bucketFor(invoice.dueDate, invoice.invoiceDate)),
      status: statusLabel(invoice.status),
    }));
    return { rows, columns: receivableAgingColumns, range };
  }

  if (report === "payables") {
    const filteredVendorBills = agingBucket ? vendorBills.filter((bill) => bucketFor(bill.dueDate, bill.billDate) === agingBucket) : vendorBills;
    const rows: CsvRow[] = filteredVendorBills.map((bill) => ({
      billNo: bill.billNo,
      vendor: bill.vendor.name,
      jobNo: bill.shipmentjob?.jobNo ?? "",
      billDate: reportDate(bill.billDate),
      dueDate: reportDate(bill.dueDate),
      billAmount: moneyCell(bdt(bill, bill.totalAmount)),
      paidAmount: moneyCell(bdt(bill, bill.paidAmount)),
      outstandingAmount: moneyCell(bdt(bill, bill.dueAmount)),
      agingBucket: agingBucketLabel(bucketFor(bill.dueDate, bill.billDate)),
      status: statusLabel(bill.status),
    }));
    return { rows, columns: payableAgingColumns, range };
  }

  // default: "profit"
  const filteredJobs = filterJobsByProfitStatus(jobs, profitStatus);
  const rows: CsvRow[] = filteredJobs.map((job) => {
    const isLocked = job.financeCloseStatus === "LOCKED";
    return {
      jobNo: job.jobNo,
      customer: job.customer.name,
      mode: job.transportMode,
      shipmentType: job.shipmentType,
      serviceScope: statusLabel(job.serviceScope),
      currentSell: moneyCell(job.totalSellAmount),
      currentBuy: moneyCell(job.totalBuyAmount),
      currentGrossProfit: moneyCell(job.grossProfit),
      currentMargin: moneyCell(job.profitMarginPercent),
      finalSell: isLocked ? moneyCell(job.finalTotalSellAmount) : "",
      finalBuy: isLocked ? moneyCell(job.finalTotalBuyAmount) : "",
      finalGrossProfit: isLocked ? moneyCell(job.finalGrossProfit) : "",
      finalMargin: isLocked ? moneyCell(job.finalProfitMarginPercent) : "",
      financeClose: statusLabel(job.financeCloseStatus),
      lockedAt: reportDate(job.financeLockedAt),
    };
  });
  return { rows, columns: financeProfitColumns, range };
}

const builders = {
  operations: buildOperationsCsv,
  workflow: buildWorkflowCsv,
  documents: buildDocumentsCsv,
  customers: buildCustomersCsv,
  vendors: buildVendorsCsv,
  requests: buildRequestsCsv,
  quotations: buildQuotationsCsv,
  financial: buildFinancialCsv,
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const builder = builders[section as keyof typeof builders];
  if (!builder) return new NextResponse("Not found", { status: 404 });

  // Same blanket "exports:csv" gate the accounting CSV route
  // (app/api/exports/accounting/[report]/route.ts) enforces -- the report
  // section permission (checked again below, inside each row-fetch function
  // via requireReportsPage) is not sufficient on its own for CSV download
  // rights.
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!hasPermission(user, "exports:csv")) return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const searchParams: ReportSearchParams = Object.fromEntries(url.searchParams.entries());

  // requireReportsPage() (called inside each row-fetch function) handles the
  // permission + branch-scope check and redirects on failure -- exactly the
  // same guard the report pages themselves use, so the CSV can never contain
  // data the viewer couldn't already see on screen.
  const { rows, columns: csvColumns, range } = await builder(searchParams);
  const csv = generateCsv(rows, csvColumns);

  const fileName = `${section}-${range.fromInput}-to-${range.toInput}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
