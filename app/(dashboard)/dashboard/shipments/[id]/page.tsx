import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, Container as ContainerIcon, Pencil, Route, Printer, Eye } from "lucide-react";
import {
  addShipmentStatus,
  deleteContainer,
  deleteShipment,
  saveContainer,
} from "@/lib/actions/shipments";
import {
  assignShipmentWorkflowStep,
  deleteShipmentWorkflowStep,
  generateShipmentWorkflow,
  updateShipmentWorkflowStep,
  getOrCreateShipmentWorkflow,
  transitionWorkflowStageAction,
  overrideWorkflowStageAction,
} from "@/lib/actions/shipment-workflow";
import type {
  DocumentOwner,
  DocumentScope,
  DocumentRequirement,
  DocumentTransportMode,
} from "@/lib/documents/config";
import {
  deleteShipmentDocument,
  rejectShipmentDocument,
  uploadShipmentDocument,
  verifyShipmentDocument,
} from "@/lib/actions/documents";
import {
  createFreightDocument,
  deleteDraftFreightDocument,
  toggleClientVisibility,
  registerExternalDocument,
} from "@/lib/actions/freight-documents";
import {
  markDeliveryOrderAction,
  markCustomsReleaseAction,
  markGatePassAction,
  markCargoReleasedAction,
  scheduleDeliveryAction,
  markOutForDeliveryAction,
  markDeliveredAction,
  uploadPodAction,
  verifyPodAction,
  markJobCloseReadyAction,
  closeJobAction,
} from "@/lib/actions/delivery-release";
import {
  GenerateFreightDocumentForm,
  DeleteDraftFreightDocumentForm,
  ToggleVisibilityForm,
  RegisterExternalDocumentForm,
} from "@/components/forms/freight-document-forms";
import {
  calculateJobFinanceSummaryForCompany,
  deleteShipmentCostItem,
  lockJobFinanceAction,
  markFinanceCloseReadyAction,
  saveShipmentCostItem,
  updateFinanceCloseExceptionsAction,
} from "@/lib/actions/finance";
import { hasModuleAccess, requireModuleAccess } from "@/lib/access/company-access";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { prisma } from "@/lib/db/prisma";
import { getDynamicChecklistForShipment } from "@/lib/documents/engine";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { getShipmentStatusFlow } from "@/lib/shipments/constants";
import { AIHealthScoreBadge } from "@/components/shipments/ai-health-score-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ConfirmDeleteButton,
  ContainerForm,
  ShipmentStatusForm,
} from "@/components/forms/shipment-forms";
import {
  DocumentRejectForm,
  DocumentUploadForm,
  VerifyButton,
} from "@/components/forms/document-forms";
import { ShipmentDetailTabs } from "@/components/shipments/shipment-detail-tabs";
import { CommercialPartiesCard } from "@/components/shipments/commercial-parties-card";
import { AIExtractMarksButton } from "@/components/shipments/ai-extract-marks-button";
import { AiShipmentSummaryCard } from "@/components/shipments/ai-shipment-summary-card";
import { AiShipmentAssistantPanel } from "@/components/shipments/ai-shipment-assistant-panel";
import { AiEmailDraftButton } from "@/components/shipments/ai-email-draft-button";
import { AIDocumentCheckerButton } from "@/components/shipments/ai-document-checker-button";
import { AIDocumentCrossCheckButton } from "@/components/shipments/ai-document-cross-check-button";
import { ShipmentCostForm } from "@/components/forms/finance-forms";
import {
  FinanceCloseActionForm,
  FinanceCloseExceptionsForm,
} from "@/components/forms/finance-closeout-forms";
import {
  WorkflowAssignmentForm,
  WorkflowGenerateForm,
  WorkflowStepUpdateForm,
  WorkflowStageTransitionForm,
  WorkflowStageOverrideForm,
} from "@/components/forms/shipment-workflow-forms";
import { serviceScopeLabels } from "@/lib/shipments/workflow-templates";
import { ShareButton } from "@/components/share/share-button";
import { buildEmailShareUrl, buildInternalShareLink, buildWhatsAppShareUrl } from "@/lib/share/share-links";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editContainer?: string }>;
};

function value(value?: unknown) {
  return value == null || value === "" ? "-" : String(value);
}

function dateValue(value?: Date | null) {
  return value ? value.toLocaleDateString() : "-";
}

function fileSize(value?: number | null) {
  if (!value) return "-";
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMoney(value: unknown) {
  return `BDT ${Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function badgeVariant(status?: string | null) {
  if (status === "Closed" || status === "Delivered") return "success";
  if (status?.includes("Cleared") || status?.includes("Confirmed")) return "success";
  if (status?.includes("Processing") || status?.includes("Submitted")) return "warning";
  return "secondary";
}

function financeBadgeVariant(status?: string | null) {
  if (status === "LOCKED") return "success";
  if (status === "CLOSE_READY") return "warning";
  return "secondary";
}

function financeBlockerLabel(blocker: string) {
  const labels: Record<string, string> = {
    missing_customer_invoice: "Missing customer invoice",
    unpaid_receivable: "Unpaid receivable",
    unresolved_vendor_payable: "Vendor payable unresolved",
    missing_vendor_bill_decision: "Missing vendor bill decision",
    job_not_operationally_close_ready: "Operational close not ready",
  };
  return labels[blocker] ?? blocker;
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-normal text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm text-slate-700">{children}</p>
    </div>
  );
}

function SummaryPill({
  label,
  value,
  danger,
}: {
  label: string;
  value: unknown;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-normal text-slate-400">
        {label}
      </p>
      <p className={danger ? "mt-2 text-lg font-semibold text-red-600" : "mt-2 text-lg font-semibold text-slate-950"}>
        {typeof value === "string" ? value : formatMoney(value)}
      </p>
    </div>
  );
}

export default async function ShipmentDetailPage({ params, searchParams }: PageProps) {
  const currentUser = await requirePermission("shipments:view");
  await requireModuleAccess(currentUser.companyId, "SHIPMENTS");
  const { id } = await params;
  const { editContainer } = await searchParams;
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");
  const companyScope = isSuperAdmin ? {} : { companyId: currentUser.companyId ?? "" };
  const accessibleBranchIds =
    !isSuperAdmin && currentUser.companyId
      ? await getAccessibleBranchIds({
          userId: currentUser.id,
          companyId: currentUser.companyId,
          permissions: currentUser.permissions ?? [],
        })
      : null;

  const rawShipment = await prisma.shipmentjob.findFirst({
    where: { id, deletedAt: null, ...companyScope, ...branchScopeWhere(accessibleBranchIds) },
    include: {
      customer: { select: { name: true, email: true, phone: true } },
      company: { select: { portalSlug: true } },
      freightdocument: {
        where: { deletedAt: null },
        include: {
          documentversion: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      },
      shipmentrequest: { select: { id: true } },
      user_shipmentjob_assignedToIdTouser: { select: { name: true, email: true } },
      user_shipmentjob_createdByIdTouser: { select: { name: true } },
      container: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      },
      shipmentstatusevent: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
      shipmentworkflowstep: {
        where: { deletedAt: null },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          user_shipmentworkflowstep_assignedUserIdTouser: { select: { name: true, email: true } },
          vendor: { select: { name: true, type: true } },
        },
      },
      shipmentdocument: {
        where: { deletedAt: null },
        include: {
          user_shipmentdocument_uploadedByIdTouser: { select: { name: true } },
          user_shipmentdocument_verifiedByIdTouser: { select: { name: true } },
          user_shipmentdocument_rejectedByIdTouser: { select: { name: true } },
        },
      },
      shipmentcostitem: {
        where: { deletedAt: null },
        include: {
          vendor: { select: { name: true } },
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      prealert: { include: { vendor: { select: { name: true } } } },
      billoflading: true,
      shippinginstruction: { include: { user: { select: { name: true } } } },
      cargoreleasechecklist: true,
    },
  });

  if (!rawShipment) notFound();

  const shipment = {
    ...rawShipment,
    freightDocuments: rawShipment.freightdocument.map((fd) => ({ ...fd, versions: fd.documentversion })),
    convertedShipmentRequest: rawShipment.shipmentrequest,
    assignedTo: rawShipment.user_shipmentjob_assignedToIdTouser,
    createdBy: rawShipment.user_shipmentjob_createdByIdTouser,
    containers: rawShipment.container,
    statusEvents: rawShipment.shipmentstatusevent.map((se) => ({ ...se, updatedBy: se.user })),
    workflowSteps: rawShipment.shipmentworkflowstep.map((ws) => ({ ...ws, assignedUser: ws.user_shipmentworkflowstep_assignedUserIdTouser })),
    documents: rawShipment.shipmentdocument.map((sd) => ({
      ...sd,
      uploadedBy: sd.user_shipmentdocument_uploadedByIdTouser,
      verifiedBy: sd.user_shipmentdocument_verifiedByIdTouser,
      rejectedBy: sd.user_shipmentdocument_rejectedByIdTouser,
    })),
    costItems: rawShipment.shipmentcostitem,
    preAlert: rawShipment.prealert ? { ...rawShipment.prealert, destinationAgent: rawShipment.prealert.vendor } : null,
    billOfLading: rawShipment.billoflading,
    shippingInstruction: rawShipment.shippinginstruction ? { ...rawShipment.shippinginstruction, submittedBy: rawShipment.shippinginstruction.user } : null,
    cargoReleaseChecklist: rawShipment.cargoreleasechecklist,
  };

  interface FreightDocWithVersions {
    id: string;
    documentNo: string;
    type: string;
    status: string;
    isClientVisible: boolean;
    versions: { versionNumber: number }[];
  }
  const freightDocs = (shipment as unknown as { freightDocuments: FreightDocWithVersions[] }).freightDocuments || [];

  const workflow = await getOrCreateShipmentWorkflow(shipment.id, shipment.companyId);
  const userRoles = await prisma.userrole.findMany({
    where: { userId: currentUser.id },
    include: { role: true },
  });
  const isAdminOrManager = userRoles.some(ur => ur.role.code === "COMPANY_ADMIN" || ur.role.code === "OPERATIONS_MANAGER");
  const shipmentTasksRaw = await prisma.task.findMany({
    where: { shipmentJobId: shipment.id, deletedAt: null },
    include: { user_task_assignedUserIdTouser: true, user_task_createdByIdTouser: true },
    orderBy: { createdAt: "desc" },
  });
  const shipmentTasks = shipmentTasksRaw.map(t => ({
    ...t,
    assignedUser: t.user_task_assignedUserIdTouser,
    createdBy: t.user_task_createdByIdTouser,
  }));

  const editingContainer = editContainer
    ? await prisma.container.findFirst({
        where: {
          id: editContainer,
          companyId: shipment.companyId,
          shipmentJobId: shipment.id,
          deletedAt: null,
        },
      })
    : null;

  if (editContainer && !editingContainer) notFound();

  const allShipmentContainerIds = await prisma.container.findMany({
    where: {
      companyId: shipment.companyId,
      shipmentJobId: shipment.id,
    },
    select: { id: true },
  });

  const allShipmentDocumentIds = await prisma.shipmentdocument.findMany({
    where: {
      companyId: shipment.companyId,
      shipmentJobId: shipment.id,
    },
    select: { id: true },
  });

  const allShipmentCostItemIds = await prisma.shipmentcostitem.findMany({
    where: {
      companyId: shipment.companyId,
      shipmentJobId: shipment.id,
    },
    select: { id: true },
  });
  const allShipmentWorkflowStepIds = await prisma.shipmentworkflowstep.findMany({
    where: {
      companyId: shipment.companyId,
      shipmentJobId: shipment.id,
    },
    select: { id: true },
  });

  const [
    costingVendors,
    costingCustomers,
    costingQuotations,
    workflowUsers,
    workflowVendors,
  ] = await Promise.all([
    prisma.vendor.findMany({
      where: { companyId: shipment.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { companyId: shipment.companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.quotation.findMany({
      where: { companyId: shipment.companyId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, quoteNo: true },
    }),
    prisma.user.findMany({
      where: {
        companyId: shipment.companyId,
        scope: "COMPANY",
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    prisma.vendor.findMany({
      where: {
        companyId: shipment.companyId,
        status: "ACTIVE",
        deletedAt: null,
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
  ]);

  const activeMasterChecklist = await getDynamicChecklistForShipment(shipment.id);
  const checklistItems = activeMasterChecklist.map(item => {
    const isRequired = !item.isOptional && item.isRequired;
    return {
      id: item.id,
      code: item.code || "",
      name: item.name,
      owner: item.owner as DocumentOwner,
      scope: item.media as DocumentScope,
      requirement: (isRequired ? 'MANDATORY' : 'OPTIONAL') as DocumentRequirement,
      transportMode: item.transportMode as DocumentTransportMode,
      portalVisible: item.owner !== 'INTERNAL' && item.code !== 'debit_note' && item.code !== 'credit_note',
      category: item.media === 'IMPORT' ? 'IMPORT' : item.media === 'EXPORT' ? 'EXPORT' : 'COMMON',
      isRequired,
    };
  });

  const requiredMissingCount = checklistItems.filter((item) => {
    if (!item.isRequired) return false;
    const uploads = shipment.documents.filter(
      (doc) => doc.documentName.toLowerCase() === item.name.toLowerCase() && doc.deletedAt === null
    );
    const latest = uploads.sort((a, b) => b.version - a.version)[0];
    const status = latest?.status ?? "PENDING";
    return status === "PENDING" || status === "REJECTED";
  }).length;

  const totalRequiredCount = checklistItems.filter(item => item.isRequired).length;
  const completedRequiredCount = totalRequiredCount - requiredMissingCount;
  const missingRequiredItems = checklistItems.filter((item) => {
    if (!item.isRequired) return false;
    const uploads = shipment.documents.filter(
      (doc) => doc.documentName.toLowerCase() === item.name.toLowerCase() && doc.deletedAt === null
    );
    const latest = uploads.sort((a, b) => b.version - a.version)[0];
    const status = latest?.status ?? "PENDING";
    return status === "PENDING" || status === "REJECTED";
  });

  const auditLogs = await prisma.auditlog.findMany({
    where: {
      companyId: shipment.companyId,
      OR: [
        { entityType: "ShipmentJob", entityId: shipment.id },
        {
          entityType: "Container",
          entityId: {
            in: shipment.container.map((c) => c.id),
          },
        },
        {
          entityType: "ShipmentDocument",
          entityId: { in: allShipmentDocumentIds.map((document) => document.id) },
        },
        {
          entityType: "ShipmentCostItem",
          entityId: { in: allShipmentCostItemIds.map((item) => item.id) },
        },
        {
          entityType: "ShipmentWorkflowStep",
          entityId: {
            in: allShipmentWorkflowStepIds.map((step) => step.id),
          },
        },
      ],
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const canUpdate = hasPermission(currentUser, "shipments:update");
  const canDelete = hasPermission(currentUser, "shipments:delete");
  const canManageContainers = hasPermission(currentUser, "shipments:containers:manage");
  const canUpdateStatus = hasPermission(currentUser, "shipments:status:update");
  const canViewWorkflow = hasPermission(currentUser, "shipmentWorkflow:view");
  const canUpdateWorkflow = hasPermission(currentUser, "shipmentWorkflow:update");
  const canAssignWorkflow = hasPermission(currentUser, "shipmentWorkflow:assign");
  const canDeleteWorkflow = hasPermission(currentUser, "shipmentWorkflow:delete");
  const [documentsModuleEnabled, costingModuleEnabled, billingModuleEnabled] = await Promise.all([
    hasModuleAccess(shipment.companyId, "DOCUMENTS"),
    hasModuleAccess(shipment.companyId, "COSTING"),
    hasModuleAccess(shipment.companyId, "BILLING"),
  ]);
  const canViewDocuments = documentsModuleEnabled && hasPermission(currentUser, "documents:view");
  const canUploadDocuments = documentsModuleEnabled && hasPermission(currentUser, "documents:upload");
  const canVerifyDocuments = documentsModuleEnabled && hasPermission(currentUser, "documents:verify");
  const canDeleteDocuments = documentsModuleEnabled && hasPermission(currentUser, "documents:delete");
  const canDownloadDocuments = documentsModuleEnabled && hasPermission(currentUser, "documents:download");
  const canUseAiDocumentReader = documentsModuleEnabled && canUpdate && hasPermission(currentUser, "ai:use");
  const canUseAiCopilot = hasPermission(currentUser, "ai:use");
  const canViewCosting = costingModuleEnabled && hasPermission(currentUser, "costing:view");
  const canUpdateCosting = costingModuleEnabled && hasPermission(currentUser, "costing:update");
  const canDeleteCosting = costingModuleEnabled && hasPermission(currentUser, "costing:delete");
  const canViewBilling =
    billingModuleEnabled &&
    (hasPermission(currentUser, "invoices:view") ||
      hasPermission(currentUser, "vendorBills:view") ||
      hasPermission(currentUser, "receivables:view") ||
      hasPermission(currentUser, "payables:view"));
  const [shipmentInvoices, shipmentVendorBills] = canViewBilling
    ? await Promise.all([
        prisma.invoice.findMany({
          where: { companyId: shipment.companyId, shipmentJobId: shipment.id, deletedAt: null, status: { not: "CANCELLED" } },
          select: { totalAmount: true, paidAmount: true, dueAmount: true, exchangeRateToBDT: true },
        }),
        prisma.vendorbill.findMany({
          where: { companyId: shipment.companyId, shipmentJobId: shipment.id, deletedAt: null, status: { not: "CANCELLED" } },
          select: { totalAmount: true, paidAmount: true, dueAmount: true, exchangeRateToBDT: true },
        }),
      ])
    : [[], []];
  const billingTotals = {
    invoiced: shipmentInvoices.reduce((sum, item) => sum + Number(item.totalAmount) * Number(item.exchangeRateToBDT), 0),
    customerPaid: shipmentInvoices.reduce((sum, item) => sum + Number(item.paidAmount) * Number(item.exchangeRateToBDT), 0),
    customerDue: shipmentInvoices.reduce((sum, item) => sum + Number(item.dueAmount) * Number(item.exchangeRateToBDT), 0),
    vendorBilled: shipmentVendorBills.reduce((sum, item) => sum + Number(item.totalAmount) * Number(item.exchangeRateToBDT), 0),
    vendorPaid: shipmentVendorBills.reduce((sum, item) => sum + Number(item.paidAmount) * Number(item.exchangeRateToBDT), 0),
    vendorDue: shipmentVendorBills.reduce((sum, item) => sum + Number(item.dueAmount) * Number(item.exchangeRateToBDT), 0),
  };
  const financeSummary = canViewBilling || canViewCosting
    ? await calculateJobFinanceSummaryForCompany(shipment.id, shipment.companyId)
    : null;
  const isFinanceLocked = shipment.financeCloseStatus === "LOCKED";
  const finalOrEstimatedSell = isFinanceLocked ? shipment.finalTotalSellAmount : (financeSummary?.actualCustomerInvoiceTotal ?? shipment.totalSellAmount);
  const finalOrEstimatedBuy = isFinanceLocked ? shipment.finalTotalBuyAmount : (financeSummary?.actualBuyCostTotal ?? shipment.totalBuyAmount);
  const financeGrossProfit = isFinanceLocked ? shipment.finalGrossProfit : (financeSummary?.grossProfit ?? shipment.grossProfit);
  const financeProfitMargin = isFinanceLocked ? shipment.finalProfitMarginPercent : (financeSummary?.profitMarginPercent ?? shipment.profitMarginPercent);
  const statusFlow = getShipmentStatusFlow(shipment.shipmentType);
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "workflow", label: "Workflow" },
    { id: "commercial", label: "Commercial" },
    { id: "operations", label: "Operations" },
    ...(canViewDocuments ? [{ id: "documents", label: "Documents" }] : []),
    { id: "freight-documents", label: "Freight Documents" },
    ...(canViewBilling || canViewCosting ? [{ id: "finance", label: "Finance" }] : []),
    { id: "client-portal", label: "Client Portal" },
    { id: "tasks", label: "Tasks" },
    { id: "timeline", label: "Timeline" },
    { id: "audit", label: "Audit" },
    ...(canUseAiCopilot ? [{ id: "ai-copilot", label: "AI Copilot" }] : []),
  ];
  const hasNegativeProfit = Number(shipment.grossProfit) < 0;
  const sharePath = shipment.company.portalSlug
    ? shipment.convertedShipmentRequest
      ? `/portal/${shipment.company.portalSlug}/requests/${shipment.convertedShipmentRequest.id}`
      : `/portal/${shipment.company.portalSlug}`
    : "/";
  const shareLink = buildInternalShareLink(sharePath);
  const shareMessage = `Shipment ${shipment.jobNo} status: ${shipment.currentStatus ?? "In progress"}. Secure portal: ${shareLink}`;

  const latestDocumentsByName = new Map<string, (typeof shipment.documents)[number]>();
  for (const doc of shipment.documents) {
    if (doc.deletedAt) continue;
    const key = doc.documentName.toLowerCase();
    const existing = latestDocumentsByName.get(key);
    if (!existing || doc.version > existing.version) latestDocumentsByName.set(key, doc);
  }
  const crossCheckableDocumentCount = Array.from(latestDocumentsByName.values()).filter(
    (doc) => doc.filePath && (doc.status === "UPLOADED" || doc.status === "VERIFIED"),
  ).length;

  const clientDocs = checklistItems.filter(item => item.owner === 'CLIENT');
  const forwarderDocs = checklistItems.filter(item => item.owner === 'FREIGHT_FORWARDER');
  const carrierDocs = checklistItems.filter(item => item.owner === 'CARRIER');
  const customsDocs = checklistItems.filter(item => item.owner === 'CUSTOMS');
  const bankOtherDocs = checklistItems.filter(item => item.owner === 'BANK' || item.owner === 'OTHER');

  const renderDocumentsTable = (items: typeof checklistItems, title: string) => {
    if (items.length === 0) return null;
    return (
      <details open className="group border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm transition-all mb-4">
        <summary className="flex justify-between items-center px-5 py-4 font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100/80 cursor-pointer select-none border-b border-slate-100 transition-colors">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{title}</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-medium">{items.length} items</span>
          </div>
          <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200 text-xs">▼</span>
        </summary>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {items.map((item) => {
                const uploads = shipment.documents
                  .filter((doc) => doc.documentName.toLowerCase() === item.name.toLowerCase() && doc.deletedAt === null)
                  .sort((a, b) => b.version - a.version);

                const document = uploads[0]; // latest version
                const status = document?.status ?? "PENDING";
                return (
                  <tr key={item.code} className={item.isRequired && status === "PENDING" ? "bg-amber-50/50" : ""}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-slate-950">{item.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge variant={item.isRequired ? "warning" : "secondary"}>
                          {item.isRequired ? "Required" : "Optional"}
                        </Badge>
                        {item.transportMode !== "ALL" && (
                          <Badge variant="secondary">{item.transportMode}</Badge>
                        )}
                      </div>
                      {document?.remarks ? (
                        <p className="mt-2 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block">Remarks: {document.remarks}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge
                        variant={
                          status === "VERIFIED"
                            ? "success"
                            : status === "REJECTED"
                              ? "danger"
                              : status === "UPLOADED"
                                ? "warning"
                                : "secondary"
                        }
                      >
                        {status}
                      </Badge>
                      {document ? <p className="mt-1 text-xs text-slate-500">v{document.version}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600 align-top">
                      {document?.fileName ? (
                        <div className="space-y-1">
                          <p className="font-medium text-slate-800 break-all">{document.originalFileName}</p>
                          <p className="text-xs text-slate-400">{fileSize(document.fileSize)}</p>
                          {canDownloadDocuments ? (
                            <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2 mt-1">
                              <a href={`/api/documents/${document.id}/download`}>Download</a>
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 align-top space-y-1">
                      {document ? (
                        <>
                          <p>Uploaded: {document.uploadedAt ? `${document.uploadedAt.toLocaleString()} by ${document.uploadedBy?.name ?? "-"}` : "-"}</p>
                          {document.verifiedAt && <p>Verified: {document.verifiedAt.toLocaleString()} by {document.verifiedBy?.name ?? "-"}</p>}
                          {document.rejectedAt && <p>Rejected: {document.rejectedAt.toLocaleString()} by {document.rejectedBy?.name ?? "-"}</p>}
                        </>
                      ) : (
                        <p className="text-slate-400">No activity yet</p>
                      )}
                      
                      {/* Version History Collapsible */}
                      {uploads.length > 1 && (
                        <details className="mt-2 text-xs border border-slate-100 rounded bg-slate-50">
                          <summary className="px-2 py-1 font-semibold text-slate-600 hover:text-slate-800 cursor-pointer select-none">
                            View history ({uploads.length})
                          </summary>
                          <div className="p-2 border-t border-slate-100 divide-y divide-slate-100 text-[10px] space-y-1">
                            {uploads.map((ver) => (
                              <div key={ver.id} className="py-1 flex justify-between items-center text-slate-600 gap-2">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-slate-700">v{ver.version}: {ver.originalFileName}</p>
                                  <p className="text-slate-400">Uploaded: {ver.uploadedAt ? ver.uploadedAt.toLocaleDateString() : "-"}</p>
                                </div>
                                <Button asChild size="sm" variant="ghost" className="h-5 w-10 text-[10px] p-0 font-medium">
                                  <a href={`/api/documents/${ver.id}/download`}>Get</a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <div className="inline-grid gap-2">
                        {canUploadDocuments && !shipment.closedAt && (
                          <DocumentUploadForm
                            action={uploadShipmentDocument}
                            shipmentJobId={shipment.id}
                            checklistItemId={item.id}
                            label={document ? "Replace" : "Upload"}
                          />
                        )}
                        {document && canUseAiDocumentReader && !shipment.closedAt && (
                          <AIExtractMarksButton
                            shipmentId={shipment.id}
                            documentId={document.id}
                            documentName={document.originalFileName || document.documentName || item.name}
                          />
                        )}
                        {document && canUseAiDocumentReader && (
                          <AIDocumentCheckerButton
                            documentId={document.id}
                            documentName={document.originalFileName || document.documentName || item.name}
                          />
                        )}
                        {document && canVerifyDocuments && !shipment.closedAt && (
                          <div className="flex flex-wrap justify-end gap-1">
                            <form action={verifyShipmentDocument}>
                              <VerifyButton shipmentJobId={shipment.id} documentId={document.id} />
                            </form>
                            <DocumentRejectForm
                              action={rejectShipmentDocument}
                              shipmentJobId={shipment.id}
                              documentId={document.id}
                            />
                          </div>
                        )}
                        {document && canDeleteDocuments && status !== "VERIFIED" && !shipment.closedAt && (
                          <form action={deleteShipmentDocument} className="text-right">
                            <input type="hidden" name="shipmentJobId" value={shipment.id} />
                            <input type="hidden" name="documentId" value={document.id} />
                            <ConfirmDeleteButton label="Delete Draft" message={`Delete ${document.documentName}?`} />
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    );
  };

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Badge variant="secondary">Shipment Job File</Badge>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">
            {shipment.jobNo}
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            This job file brings routing, documents, delivery/POD, billing, and finance closeout into one operational record.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={shipment.shipmentType === "IMPORT" ? "warning" : "success"}>
              {shipment.shipmentType}
            </Badge>
            <Badge variant="secondary">{shipment.transportMode}</Badge>
            <Badge variant={badgeVariant(shipment.currentStatus)}>
              {shipment.currentStatus ?? "Not set"}
            </Badge>
            <AIHealthScoreBadge shipmentId={shipment.id} companyId={shipment.companyId} user={currentUser} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPermission(currentUser, "bookings:view") ? <Button asChild variant="outline"><Link href={`/dashboard/shipments/${shipment.id}/operations`}>Operation Workflow</Link></Button> : null}
          {hasPermission(currentUser, "tasks:create") ? <Button asChild variant="outline"><Link href={`/dashboard/tasks/new?shipmentJobId=${shipment.id}&customerId=${shipment.customerId}&returnTo=/dashboard/shipments/${shipment.id}`}>Create Task</Link></Button> : null}
          {hasPermission(currentUser, "share:view") ? <ShareButton resourceType="shipment" resourceId={shipment.id} whatsappUrl={buildWhatsAppShareUrl(shipment.customer.phone, shareMessage)} emailUrl={buildEmailShareUrl(shipment.customer.email, `Shipment ${shipment.jobNo} update`, shareMessage)} internalLink={shareLink} printUrl={hasPermission(currentUser, "exports:print") ? `/dashboard/shipments/${shipment.id}/print` : null} downloadUrl={hasPermission(currentUser, "exports:pdf") ? `/api/shipments/${shipment.id}/summary-pdf` : null} canCreateOutbox={hasPermission(currentUser, "share:create")} /> : null}
          {hasPermission(currentUser, "share:view") && canUseAiCopilot ? (
            <AiEmailDraftButton shipmentId={shipment.id} customerEmail={shipment.customer.email} />
          ) : null}
          {hasPermission(currentUser, "exports:print") ? <Button asChild variant="outline"><Link href={`/dashboard/shipments/${shipment.id}/print`}>Print Summary</Link></Button> : null}
          {hasPermission(currentUser, "exports:pdf") ? <Button asChild variant="outline"><a download href={`/api/shipments/${shipment.id}/summary-pdf`}>Download Summary PDF</a></Button> : null}
          {canUpdate ? (
            <Button asChild variant="outline">
              <Link href={`/dashboard/shipments/${shipment.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : null}
          {canDelete ? (
            <form action={deleteShipment}>
              <input type="hidden" name="id" value={shipment.id} />
              <ConfirmDeleteButton label="Delete" message={`Delete shipment ${shipment.jobNo}?`} />
            </form>
          ) : null}
        </div>
      </div>

      <ShipmentDetailTabs tabs={tabs}>

      <section id="overview" className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Core routing, cargo, customer, and service-scope details for this shipment job file.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-3">
            <DetailItem label="Customer">{shipment.customer.name}</DetailItem>
            <DetailItem label="Assigned">{shipment.assignedTo.name}</DetailItem>
            <DetailItem label="Created by">{shipment.createdBy.name}</DetailItem>
            <DetailItem label="Origin">{shipment.originCountry} / {value(shipment.originPort)}</DetailItem>
            <DetailItem label="Destination">{shipment.destinationCountry} / {value(shipment.destinationPort)}</DetailItem>
            <DetailItem label="Trade term">{value(shipment.tradeTerm)}</DetailItem>
            <DetailItem label="Service scope">
              {serviceScopeLabels[shipment.serviceScope]}
            </DetailItem>
            <DetailItem label="Pickup address">{value(shipment.pickupAddress)}</DetailItem>
            <DetailItem label="Delivery address">{value(shipment.deliveryAddress)}</DetailItem>
            <DetailItem label="ETD">{dateValue(shipment.etd)}</DetailItem>
            <DetailItem label="ETA">{dateValue(shipment.eta)}</DetailItem>
            <DetailItem label="BL / AWB date">{dateValue(shipment.blOrAwbDate)}</DetailItem>
            <DetailItem label="Cargo">{shipment.cargoDescription}</DetailItem>
            <DetailItem label="Packages">{value(shipment.packageCount)} {value(shipment.packageType)}</DetailItem>
            <DetailItem label="Weight / CBM">{value(shipment.grossWeight)} / {value(shipment.cbm)}</DetailItem>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Summary</CardTitle>
            <CardDescription>Current milestone progress and blockers. Next: clear missing requirements before moving the job forward.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <SummaryPill label="Progress" value={`${shipment.workflowProgressPercent}%`} />
            <DetailItem label="Current stage">{shipment.currentStageCode?.replaceAll("_", " ") ?? "Not set"}</DetailItem>
            <DetailItem label="Blocked stages count">{String(shipment.blockedStageCount)}</DetailItem>
            {shipment.missingRequirementList && (
              <div className="mt-2 rounded-md bg-amber-50 p-3 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 uppercase">Missing Requirements</p>
                <p className="mt-1 text-xs text-amber-700">{shipment.missingRequirementList}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section id="workflow" className="space-y-4 scroll-mt-20">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Workflow Engine</CardTitle>
                <CardDescription>
                  Strict sequential milestones for {shipment.transportMode} {shipment.shipmentType} ({shipment.serviceScope.replaceAll("_", " ")}). Every stage must satisfy required fields, documents, and approvals before proceeding.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                <span>Workflow Progress</span>
                <span>{workflow?.progressPercent ?? 0}%</span>
              </div>
              <div className="mt-2 h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${workflow?.progressPercent ?? 0}%` }}
                />
              </div>
            </div>

            {/* Stages list */}
            <div className="space-y-3">
              {workflow?.stages.map((stage) => {
                const isOverridden = workflow.overrides.some((o) => o.stageCode === stage.stageCode);
                const hasManualAction = stage.requirements.length === 0 || stage.requirements.every((r) => r.type === "PREVIOUS_STAGE");
                const canCompleteManual = hasManualAction && (stage.status === "PENDING" || stage.status === "IN_PROGRESS" || stage.status === "BLOCKED");

                return (
                  <div key={stage.id} className="rounded-md border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex gap-3">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          stage.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                          stage.status === "BLOCKED" ? "bg-red-100 text-red-800" :
                          stage.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"
                        }`}>
                          {Math.max(1, Math.round(stage.sortOrder / 10))}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-semibold text-slate-950">{stage.stageName}</h4>
                            <Badge variant={
                              stage.status === "COMPLETED" ? "success" :
                              stage.status === "BLOCKED" ? "danger" :
                              stage.status === "IN_PROGRESS" ? "warning" : "secondary"
                            }>
                              {stage.status.replaceAll("_", " ")}
                            </Badge>
                            {isOverridden && <Badge variant="warning">Overridden</Badge>}
                          </div>
                          {stage.blockedReason && (
                            <p className="mt-1 text-xs font-medium text-red-600">Blocked reason: {stage.blockedReason}</p>
                          )}
                          
                          {/* Requirements */}
                          {stage.requirements.length > 0 && (
                            <div className="mt-3 space-y-1 bg-slate-50/50 p-2.5 rounded border border-slate-100">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unlock Requirements</p>
                              {stage.requirements.map((req) => (
                                <div key={req.id} className="flex items-center gap-2 text-xs text-slate-600">
                                  <span className={`inline-block h-2 w-2 rounded-full ${req.isFulfilled ? "bg-emerald-500" : "bg-red-500"}`} />
                                  <span className={req.isFulfilled ? "line-through text-slate-400" : "font-medium"}>
                                    [{req.type}] {req.description}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {stage.completedBy && (
                            <p className="mt-2 text-[11px] text-slate-500">
                              Completed by {stage.completedBy.name} on {stage.completedAt ? new Date(stage.completedAt).toLocaleString() : "-"}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 items-start shrink-0">
                        {canCompleteManual && (
                          <WorkflowStageTransitionForm
                            action={transitionWorkflowStageAction}
                            shipmentJobId={shipment.id}
                            stageCode={stage.stageCode}
                          />
                        )}

                        {stage.status === "BLOCKED" && isAdminOrManager && (
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 uppercase">Manager Override</p>
                            <WorkflowStageOverrideForm
                              action={overrideWorkflowStageAction}
                              shipmentJobId={shipment.id}
                              stageCode={stage.stageCode}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {canViewWorkflow ? (
          <Card id="operations-workflow">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Operations Workflow Checklist</CardTitle>
                  <CardDescription>
                    {serviceScopeLabels[shipment.serviceScope]} operational steps.
                    Handler assignments and notes are internal company information. Use this checklist to see the next operational action.
                  </CardDescription>
                </div>
                {canUpdateWorkflow &&
                (!shipment.workflowSteps.length ||
                  !shipment.workflowSteps.some((step) => step.status === "COMPLETED")) ? (
                  <WorkflowGenerateForm
                    action={generateShipmentWorkflow}
                    shipmentJobId={shipment.id}
                    regenerate={shipment.workflowSteps.length > 0}
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {shipment.workflowSteps.map((step) => (
                <div
                  key={step.id}
                  className="rounded-md border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {Math.max(1, Math.round(step.sortOrder / 10))}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">{step.title}</p>
                          <Badge variant="secondary">{step.phase}</Badge>
                          <Badge
                            variant={
                              step.status === "COMPLETED"
                                ? "success"
                                : step.status === "BLOCKED"
                                  ? "danger"
                                  : step.status === "IN_PROGRESS" ||
                                      step.status === "WAITING"
                                    ? "warning"
                                    : "secondary"
                            }
                          >
                            {step.status.replaceAll("_", " ")}
                          </Badge>
                          <Badge variant={step.isRequired ? "warning" : "secondary"}>
                            {step.isRequired ? "Required" : "Optional"}
                          </Badge>
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-slate-500 md:grid-cols-2 xl:grid-cols-4">
                          <span>
                            Handler: {step.handlerType?.replaceAll("_", " ") ?? "Unassigned"}
                          </span>
                          <span>
                            Assigned: {step.assignedUser?.name ?? step.vendor?.name ?? "-"}
                          </span>
                          <span>Due: {dateValue(step.dueDate)}</span>
                          <span>Completed: {dateValue(step.completedAt)}</span>
                        </div>
                        {step.notes ? (
                          <p className="mt-2 text-sm text-slate-600">{step.notes}</p>
                        ) : null}
                      </div>
                    </div>
                    {canDeleteWorkflow ? (
                      <form action={deleteShipmentWorkflowStep}>
                        <input type="hidden" name="shipmentJobId" value={shipment.id} />
                        <input type="hidden" name="workflowStepId" value={step.id} />
                        <ConfirmDeleteButton
                          label="Delete"
                          message={`Delete workflow step ${step.title}?`}
                        />
                      </form>
                    ) : null}
                  </div>
                  <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
                    {canUpdateWorkflow ? (
                      <WorkflowStepUpdateForm
                        action={updateShipmentWorkflowStep}
                        shipmentJobId={shipment.id}
                        step={step}
                      />
                    ) : null}
                    {canAssignWorkflow ? (
                      <WorkflowAssignmentForm
                        action={assignShipmentWorkflowStep}
                        shipmentJobId={shipment.id}
                        step={step}
                        users={workflowUsers}
                        vendors={workflowVendors}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
              {!shipment.workflowSteps.length ? (
                <div className="rounded-md border border-dashed border-slate-200 p-8 text-center">
                  <Route className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm text-slate-600">
                    This shipment does not have an operations workflow yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Generate a workflow when the job is ready for step-by-step operations tracking.
                  </p>
                </div>
              ) : null}
              {shipment.workflowSteps.some((step) => step.status === "COMPLETED") ? (
                <p className="text-xs text-slate-500">
                  Workflow regeneration is disabled because completed steps must be preserved.
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section id="commercial" className="grid gap-4 xl:grid-cols-2 scroll-mt-20">
        <CommercialPartiesCard
          shipmentId={shipment.id}
          initialParties={{
            shipperName: shipment.shipperName,
            shipperAddress: shipment.shipperAddress,
            consigneeName: shipment.consigneeName,
            consigneeAddress: shipment.consigneeAddress,
            consigneeBin: shipment.consigneeBin,
            notifyPartyName: shipment.notifyPartyName,
            notifyPartyAddress: shipment.notifyPartyAddress,
            notifyPartyBin: shipment.notifyPartyBin,
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
            <CardDescription>Client account profile details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailItem label="Company Name">{shipment.customer.name}</DetailItem>
            <DetailItem label="Email Address">{value(shipment.customer.email)}</DetailItem>
            <DetailItem label="Phone Number">{value(shipment.customer.phone)}</DetailItem>
          </CardContent>
        </Card>
      </section>

      <section id="operations" className="space-y-4 scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Booking & Routing Details</CardTitle>
            <CardDescription>Carrier specifications, voyage schedules, and stuffing details.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-3">
            <DetailItem label="Carrier Name">{value(shipment.carrierName)}</DetailItem>
            <DetailItem label="Shipping line or airline">{value(shipment.shippingLineOrAirline)}</DetailItem>
            <DetailItem label="Vessel / Flight">{[shipment.vesselName, shipment.voyageNo, shipment.flightNo].filter(Boolean).join(" / ") || "-"}</DetailItem>
            <DetailItem label="Booking Number">{value(shipment.bookingNo)}</DetailItem>
            <DetailItem label="ETD / Departure">{dateValue(shipment.etd)}</DetailItem>
            <DetailItem label="ETA / Arrival">{dateValue(shipment.eta)}</DetailItem>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Containers</CardTitle>
            <CardDescription>Manage containers linked to this shipment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {canManageContainers ? (
              <ContainerForm
                action={saveContainer}
                shipmentJobId={shipment.id}
                container={editingContainer ? JSON.parse(JSON.stringify(editingContainer)) : null}
              />
            ) : null}
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Container</th>
                    <th className="px-4 py-3">Weight / CBM</th>
                    <th className="px-4 py-3">Free time</th>
                    <th className="px-4 py-3">Risk</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {shipment.containers.map((container) => (
                    <tr key={container.id}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-slate-950">
                          <ContainerIcon className="h-4 w-4 text-slate-400" />
                          {container.containerNo}
                        </div>
                        <p className="text-xs text-slate-500">{value(container.containerType)} / Seal {value(container.sealNo)}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{value(container.grossWeight)} / {value(container.cbm)}</td>
                      <td className="px-4 py-3 text-slate-600">{dateValue(container.freeTimeLastDate)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={container.demurrageRiskStatus === "CRITICAL" ? "danger" : container.demurrageRiskStatus === "WARNING" ? "warning" : "secondary"}>
                          {container.demurrageRiskStatus.replaceAll("_", " ")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {canManageContainers ? (
                            <>
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/dashboard/shipments/${shipment.id}?editContainer=${container.id}#operations`}>Edit</Link>
                              </Button>
                              <form action={deleteContainer}>
                                <input type="hidden" name="id" value={container.id} />
                                <ConfirmDeleteButton label="Delete" message={`Delete container ${container.containerNo}?`} />
                              </form>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!shipment.containers.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No containers added.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {canViewDocuments ? (
        <section id="documents" className="scroll-mt-20">
          <Card>
            <CardHeader>
              <CardTitle>Documents Checklist</CardTitle>
              <CardDescription>
                Operational document lifecycle files grouped by department. Complete all mandatory files before operational close.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {hasPermission(currentUser, "exports:print") ? <Button asChild variant="outline"><Link href={`/dashboard/shipments/${shipment.id}/documents/print`}>Print Checklist</Link></Button> : null}
                {hasPermission(currentUser, "exports:pdf") ? <Button asChild variant="outline"><a download href={`/api/shipments/${shipment.id}/document-checklist-pdf`}>Download Checklist PDF</a></Button> : null}
                {canUseAiDocumentReader ? (
                  <AIDocumentCrossCheckButton shipmentJobId={shipment.id} documentCount={crossCheckableDocumentCount} />
                ) : null}
              </div>

              <div className="space-y-4 mt-4">
                {renderDocumentsTable(clientDocs, "Client Documents")}
                {renderDocumentsTable(forwarderDocs, "Freight Forwarder Documents")}
                {renderDocumentsTable(carrierDocs, "Carrier Documents")}
                {renderDocumentsTable(customsDocs, "Customs Documents")}
                {renderDocumentsTable(bankOtherDocs, "Bank & Other Documents")}
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section id="freight-documents" className="space-y-6 scroll-mt-20">
        {/* New Generated Freight Documents section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Generated Freight Documents</CardTitle>
                <CardDescription>
                  Generate HBL, HAWB, manifests, debit notes, and delivery documents. Client-visible documents can be shared to the portal; internal documents stay hidden.
                  Locked documents are read-only. Use amendment workflow if changes are needed.
                </CardDescription>
              </div>
              {canUpdate && (
                <div className="flex flex-wrap items-center gap-3">
                  <GenerateFreightDocumentForm
                    action={createFreightDocument}
                    shipmentJobId={shipment.id}
                  />
                  <RegisterExternalDocumentForm
                    action={registerExternalDocument}
                    shipmentJobId={shipment.id}
                  />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Document Number</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Client Portal</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {freightDocs.map((doc) => {
                    const latestVersion = doc.versions[0];
                    const canDeleteDraft = canUpdate && doc.status === "DRAFT" && !doc.isClientVisible;
                    return (
                      <tr key={doc.id}>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <Link
                            href={`/dashboard/shipments/${shipment.id}/freight-documents/${doc.id}`}
                            className="hover:underline text-emerald-700"
                          >
                            {doc.documentNo}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{doc.type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          v{latestVersion?.versionNumber || 1}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              doc.status === "LOCKED" ? "success" :
                              doc.status === "APPROVED" ? "success" :
                              doc.status === "UNDER_REVIEW" ? "warning" : "secondary"
                            }
                          >
                            {doc.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <ToggleVisibilityForm
                            action={toggleClientVisibility}
                            documentId={doc.id}
                            isClientVisible={doc.isClientVisible}
                          />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button asChild size="icon" variant="outline" className="h-8 w-8" title={doc.status === "LOCKED" ? "View Details" : "Edit / Manage"}>
                              <Link href={`/dashboard/shipments/${shipment.id}/freight-documents/${doc.id}`}>
                                {doc.status === "LOCKED" ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <Pencil className="h-4 w-4" />
                                )}
                              </Link>
                            </Button>
                            {canDeleteDraft ? (
                              <DeleteDraftFreightDocumentForm
                                action={deleteDraftFreightDocument}
                                documentId={doc.id}
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!freightDocs.length ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        No freight documents generated or registered yet. Generate a document or register an external file when it is available.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Operational Status References */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-sm font-semibold text-slate-600 mb-4">Operations Milestone References</h3>
          <div className="grid gap-4 xl:grid-cols-2">
            {/* Bill of Lading card */}
            <Card>
              <CardHeader>
                <CardTitle>Bill of Lading / AWB Reference</CardTitle>
                <CardDescription>Draft approvals and release status.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <DetailItem label="Document Type">{shipment.billOfLading?.documentType ?? "Not set"}</DetailItem>
                <DetailItem label="Draft Number">{value(shipment.billOfLading?.draftNumber)}</DetailItem>
                <DetailItem label="Approval status">
                  <Badge variant={badgeVariant(shipment.billOfLading?.approvalStatus)}>
                    {shipment.billOfLading?.approvalStatus?.replaceAll("_", " ") ?? "Not set"}
                  </Badge>
                </DetailItem>
                <DetailItem label="Final locked">{shipment.billOfLading?.finalLocked ? `Locked on ${dateValue(shipment.billOfLading?.finalLockedAt)}` : "No"}</DetailItem>
                <DetailItem label="Release preference">{value(shipment.billOfLading?.releaseType?.replaceAll("_", " "))}</DetailItem>
              </CardContent>
            </Card>

            {/* Shipping Instruction card */}
            <Card>
              <CardHeader>
                <CardTitle>Shipping Instruction (SI)</CardTitle>
                <CardDescription>Submitted shipper/consignee templates for carrier.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <DetailItem label="SI Status">
                  <Badge variant={badgeVariant(shipment.shippingInstruction?.status)}>
                    {shipment.shippingInstruction?.status ?? "Not started"}
                  </Badge>
                </DetailItem>
                <DetailItem label="Vessel / Voyage Flight">{value(shipment.shippingInstruction?.vesselVoyageFlight)}</DetailItem>
                <DetailItem label="Submitted date">{dateValue(shipment.shippingInstruction?.submittedAt)}</DetailItem>
                <DetailItem label="Submitted by">{shipment.shippingInstruction?.submittedBy?.name ?? "-"}</DetailItem>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 mt-4">
            {/* Pre-alert card */}
            <Card>
              <CardHeader>
                <CardTitle>Pre-alert</CardTitle>
                <CardDescription>Arrival advice dispatch to destination port.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <DetailItem label="Status">
                  <Badge variant={badgeVariant(shipment.preAlert?.status)}>
                    {shipment.preAlert?.status ?? "Not started"}
                  </Badge>
                </DetailItem>
                <DetailItem label="Destination Agent">{shipment.preAlert?.destinationAgent?.name ?? "-"}</DetailItem>
                <DetailItem label="Sent Date">{dateValue(shipment.preAlert?.sentAt)}</DetailItem>
              </CardContent>
            </Card>

            {/* Delivery & Release Management Panel */}
            <Card className="col-span-full">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>Delivery & Cargo Release Operations</CardTitle>
                    <CardDescription>
                      Manage Delivery Order, Gate Pass, Cargo Released, Out for Delivery, Delivered, POD Pending / POD Verified, and Job Close Ready status.
                      Next: complete required documents before delivery release.
                    </CardDescription>
                  </div>
                  {shipment.closedAt ? (
                    <Badge variant="success">Closed on {dateValue(shipment.closedAt)}</Badge>
                  ) : shipment.operationsStatus === "CLOSE_READY" ? (
                    <Badge variant="warning">Close Ready</Badge>
                  ) : (
                    <Badge variant="secondary">Active Operations</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 1. Status Grid */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 border-b pb-6">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Delivery Order</p>
                    <Badge className="mt-1" variant={
                      freightDocs.find(d => d.type === "DELIVERY_ORDER")?.status === "VERIFIED" ? "success" :
                      freightDocs.find(d => d.type === "DELIVERY_ORDER")?.status === "RECEIVED" ? "warning" : "secondary"
                    }>
                      {freightDocs.find(d => d.type === "DELIVERY_ORDER")?.status ?? "PENDING"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Customs Clearance</p>
                    <Badge className="mt-1" variant={
                      freightDocs.find(d => d.type === "CUSTOMS_RELEASE")?.status === "VERIFIED" ? "success" :
                      freightDocs.find(d => d.type === "CUSTOMS_RELEASE")?.status === "RECEIVED" ? "warning" : "secondary"
                    }>
                      {freightDocs.find(d => d.type === "CUSTOMS_RELEASE")?.status ?? "PENDING"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Gate Pass</p>
                    <Badge className="mt-1" variant={
                      freightDocs.find(d => d.type === "GATE_PASS")?.status === "VERIFIED" ? "success" :
                      freightDocs.find(d => d.type === "GATE_PASS")?.status === "RECEIVED" ? "warning" : "secondary"
                    }>
                      {freightDocs.find(d => d.type === "GATE_PASS")?.status ?? "PENDING"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Cargo Release</p>
                    <Badge className="mt-1" variant={shipment.cargoReleaseChecklist?.cargoReleased ? "success" : "secondary"}>
                      {shipment.cargoReleaseChecklist?.cargoReleased ? "RELEASED" : "PENDING"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">Delivery Stage</p>
                    <Badge className="mt-1" variant={
                      shipment.cargoReleaseChecklist?.delivered ? "success" :
                      shipment.cargoReleaseChecklist?.outForDeliveryAt ? "warning" :
                      shipment.cargoReleaseChecklist?.deliveryDateTime ? "warning" : "secondary"
                    }>
                      {shipment.cargoReleaseChecklist?.delivered ? "DELIVERED" :
                       shipment.cargoReleaseChecklist?.outForDeliveryAt ? "OUT FOR DELIVERY" :
                       shipment.cargoReleaseChecklist?.deliveryDateTime ? "SCHEDULED" : "PENDING"}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase">POD Verification</p>
                    <Badge className="mt-1" variant={
                      freightDocs.find(d => d.type === "POD")?.status === "VERIFIED" ? "success" :
                      freightDocs.find(d => d.type === "POD")?.status === "RECEIVED" ? "warning" : "secondary"
                    }>
                      {freightDocs.find(d => d.type === "POD")?.status ?? "PENDING"}
                    </Badge>
                  </div>
                </div>

                {/* 2. Operations and Forms */}
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Left Column: Required Document Gates & Operations */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Document Verification Gates</h3>

                    {/* Delivery Order Gate */}
                    <div data-testid="delivery-order-gate" className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">1. Delivery Order (DO)</p>
                        <p className="text-xs text-slate-500">Carrier release document required before cargo release.</p>
                      </div>
                      {!shipment.closedAt && (
                        <form action={markDeliveryOrderAction} className="flex gap-2">
                          <input type="hidden" name="shipmentJobId" value={shipment.id} />
                          <button type="submit" name="status" value="RECEIVED" className="px-2 py-1 text-xs rounded border bg-white hover:bg-slate-50">Received</button>
                          <button type="submit" name="status" value="VERIFIED" className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">Verify</button>
                        </form>
                      )}
                    </div>

                    {/* Customs Release Gate */}
                    <div data-testid="customs-release-gate" className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">2. Customs Release</p>
                        <p className="text-xs text-slate-500">Bill of Entry / Export Dec clearance</p>
                      </div>
                      {!shipment.closedAt && (
                        <form action={markCustomsReleaseAction} className="flex gap-2">
                          <input type="hidden" name="shipmentJobId" value={shipment.id} />
                          <button type="submit" name="status" value="RECEIVED" className="px-2 py-1 text-xs rounded border bg-white hover:bg-slate-50">Received</button>
                          <button type="submit" name="status" value="VERIFIED" className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">Verify</button>
                        </form>
                      )}
                    </div>

                    {/* Gate Pass Gate */}
                    <div data-testid="gate-pass-gate" className="flex items-center justify-between p-3 rounded-lg border bg-slate-50 text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">3. Terminal Gate Pass</p>
                        <p className="text-xs text-slate-500">Port / Warehouse exit authorization</p>
                      </div>
                      {!shipment.closedAt && (
                        <form action={markGatePassAction} className="flex gap-2">
                          <input type="hidden" name="shipmentJobId" value={shipment.id} />
                          <button type="submit" name="status" value="RECEIVED" className="px-2 py-1 text-xs rounded border bg-white hover:bg-slate-50">Received</button>
                          <button type="submit" name="status" value="VERIFIED" className="px-2 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">Verify</button>
                        </form>
                      )}
                    </div>

                    {/* Cargo Release and Dispatch Actions */}
                    <h3 className="text-sm font-bold text-slate-900 border-b pb-2 pt-2">Cargo Dispatch Actions</h3>
                    <div className="grid gap-2">
                      {/* Mark Cargo Released */}
                      <form data-testid="release-cargo-form" action={markCargoReleasedAction} className="flex justify-between items-center p-3 rounded-lg border bg-slate-50 text-sm">
                        <input type="hidden" name="shipmentJobId" value={shipment.id} />
                        <div>
                          <p className="font-semibold text-slate-800">Port / CFS Cargo Release</p>
                          <p className="text-xs text-slate-500">Requires Delivery Order and Customs Clearance to be complete.</p>
                        </div>
                        <Button type="submit" disabled={shipment.cargoReleaseChecklist?.cargoReleased || !!shipment.closedAt} size="sm">
                          Release Cargo
                        </Button>
                      </form>

                      {/* Out for Delivery */}
                      <form data-testid="out-for-delivery-form" action={markOutForDeliveryAction} className="flex justify-between items-center p-3 rounded-lg border bg-slate-50 text-sm">
                        <input type="hidden" name="shipmentJobId" value={shipment.id} />
                        <div>
                          <p className="font-semibold text-slate-800">Out for Delivery</p>
                          <p className="text-xs text-slate-500">Mark consignment as dispatched on vehicle after cargo release.</p>
                        </div>
                        <Button type="submit" disabled={!shipment.cargoReleaseChecklist?.cargoReleased || !!shipment.cargoReleaseChecklist?.delivered || !!shipment.cargoReleaseChecklist?.outForDeliveryAt || !!shipment.closedAt} size="sm" variant="outline">
                          Dispatch
                        </Button>
                      </form>

                      {/* Mark Delivered */}
                      <form data-testid="confirm-delivery-form" action={markDeliveredAction} className="flex justify-between items-center p-3 rounded-lg border bg-slate-50 text-sm">
                        <input type="hidden" name="shipmentJobId" value={shipment.id} />
                        <div>
                          <p className="font-semibold text-slate-800">Confirm Delivery</p>
                          <p className="text-xs text-slate-500">Confirm cargo handover to consignee before POD verification.</p>
                        </div>
                        <Button type="submit" disabled={shipment.cargoReleaseChecklist?.delivered || !!shipment.closedAt} size="sm" variant="default">
                          Delivered
                        </Button>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: Scheduling & POD Verification */}
                  <div className="space-y-4">
                    {/* Delivery Scheduling Form */}
                    <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Delivery Scheduling</h3>
                    <form data-testid="delivery-schedule-form" action={scheduleDeliveryAction} className="grid gap-3 text-sm">
                      <input type="hidden" name="shipmentJobId" value={shipment.id} />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-medium text-slate-600">Location
                          <input disabled={!!shipment.closedAt} name="deliveryLocation" defaultValue={shipment.cargoReleaseChecklist?.deliveryLocation ?? ""} className="w-full mt-1 rounded border p-1 text-xs" placeholder="e.g. CFS Depot" />
                        </label>
                        <label className="block text-xs font-medium text-slate-600">Consignee Contact
                          <input disabled={!!shipment.closedAt} name="consigneeContact" defaultValue={shipment.cargoReleaseChecklist?.consigneeContact ?? ""} className="w-full mt-1 rounded border p-1 text-xs" placeholder="Phone/Name" />
                        </label>
                      </div>
                      <label className="block text-xs font-medium text-slate-600">Delivery Address
                        <textarea disabled={!!shipment.closedAt} name="deliveryAddress" rows={2} defaultValue={shipment.cargoReleaseChecklist?.deliveryAddress ?? shipment.deliveryAddress ?? ""} className="w-full mt-1 rounded border p-1 text-xs" />
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-medium text-slate-600">Schedule Date/Time
                          <input disabled={!!shipment.closedAt} type="datetime-local" name="deliveryDateTime" defaultValue={shipment.cargoReleaseChecklist?.deliveryDateTime ? new Date(new Date(shipment.cargoReleaseChecklist.deliveryDateTime).getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0, 16) : ""} className="w-full mt-1 rounded border p-1 text-xs" />
                        </label>
                        <label className="block text-xs font-medium text-slate-600">Truck / Vehicle No
                          <input disabled={!!shipment.closedAt} name="truckVehicleNo" defaultValue={shipment.cargoReleaseChecklist?.truckVehicleNo ?? ""} className="w-full mt-1 rounded border p-1 text-xs" />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-medium text-slate-600">Driver Name
                          <input disabled={!!shipment.closedAt} name="driverName" defaultValue={shipment.cargoReleaseChecklist?.driverName ?? ""} className="w-full mt-1 rounded border p-1 text-xs" />
                        </label>
                        <label className="block text-xs font-medium text-slate-600">Driver Phone
                          <input disabled={!!shipment.closedAt} name="driverPhone" defaultValue={shipment.cargoReleaseChecklist?.driverPhone ?? ""} className="w-full mt-1 rounded border p-1 text-xs" />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block text-xs font-medium text-slate-600">Transport Vendor ID
                          <input disabled={!!shipment.closedAt} name="transportVendorId" defaultValue={shipment.cargoReleaseChecklist?.transportVendorId ?? ""} className="w-full mt-1 rounded border p-1 text-xs" />
                        </label>
                        <label className="block text-xs font-medium text-slate-600">Warehouse Name
                          <input disabled={!!shipment.closedAt} name="warehouseName" defaultValue={shipment.cargoReleaseChecklist?.warehouseName ?? ""} className="w-full mt-1 rounded border p-1 text-xs" />
                        </label>
                      </div>
                      <label className="block text-xs font-medium text-slate-600">Remarks
                        <input disabled={!!shipment.closedAt} name="deliveryRemarks" defaultValue={shipment.cargoReleaseChecklist?.deliveryRemarks ?? ""} className="w-full mt-1 rounded border p-1 text-xs" />
                      </label>
                      {!shipment.closedAt && (
                        <Button type="submit" size="sm" className="w-full">Save Schedule</Button>
                      )}
                    </form>

                    {/* POD Section */}
                    <h3 className="text-sm font-bold text-slate-900 border-b pb-2 pt-2">Proof of Delivery (POD)</h3>
                    <p className="text-xs text-slate-500">Upload POD after delivery, then verify it before final job closeout.</p>
                    <div className="space-y-3">
                      <form data-testid="pod-upload-form" action={uploadPodAction} className="space-y-2 text-sm">
                        <input type="hidden" name="shipmentJobId" value={shipment.id} />
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block text-xs font-medium text-slate-600">POD Reference
                            <input disabled={!!shipment.closedAt} name="podReferenceNo" defaultValue={shipment.cargoReleaseChecklist?.podReferenceNo ?? ""} className="w-full mt-1 rounded border p-1 text-xs" />
                          </label>
                          <label className="block text-xs font-medium text-slate-600">Attach POD file
                            <input disabled={!!shipment.closedAt} type="file" name="file" className="w-full mt-1 text-xs" />
                          </label>
                        </div>
                        {!shipment.closedAt && (
                          <Button type="submit" size="sm" variant="outline" className="w-full">Upload POD</Button>
                        )}
                      </form>

                      {/* Verify POD Form */}
                      <form data-testid="pod-verify-form" action={verifyPodAction} className="flex justify-between items-center p-3 rounded-lg border bg-slate-50 text-sm">
                        <input type="hidden" name="shipmentJobId" value={shipment.id} />
                        <div>
                          <p className="font-semibold text-slate-800">Verify Uploaded POD</p>
                          <p className="text-xs text-slate-500">
                            {shipment.cargoReleaseChecklist?.verifiedAt
                              ? `Verified by ${shipment.cargoReleaseChecklist.verifiedBy}`
                              : "Requires uploaded POD file first"}
                          </p>
                        </div>
                        <Button type="submit" disabled={!freightDocs.some(d => d.type === "POD") || !!shipment.cargoReleaseChecklist?.verifiedAt || !!shipment.closedAt} size="sm">
                          Verify POD
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>

                {/* 3. Job Closeout Section */}
                <div className="border-t pt-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">Job Closeout Formalities</h3>
                  
                  {requiredMissingCount > 0 ? (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg space-y-2">
                      <p className="font-bold text-sm flex items-center gap-2">
                        <span>⚠️ Operational Close Blocked: Compliance Validation Required</span>
                      </p>
                      <p className="text-xs font-semibold text-red-700">
                        {completedRequiredCount} / {totalRequiredCount} Required Documents Completed.
                      </p>
                      <div className="text-xs">
                        <p className="font-semibold text-slate-800">Missing Mandatory Documents:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          {missingRequiredItems.map(item => (
                            <li key={item.code} className="font-medium">{item.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg">
                      <p className="font-bold text-sm flex items-center gap-2">
                        <span>✅ Compliance Cleared</span>
                      </p>
                      <p className="text-xs mt-1">
                        All {totalRequiredCount} mandatory compliance documents have been completed and verified.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-50 border p-4 rounded-lg">
                    <div className="text-sm">
                      <p className="font-bold text-slate-800">Final Archival and Operations Sync</p>
                      <p className="text-xs text-slate-500">
                        Locks operation status, verifies all workflow stages completed, and records final closed state. Finance can then complete closeout review.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={markJobCloseReadyAction}>
                        <input type="hidden" name="shipmentJobId" value={shipment.id} />
                        <Button type="submit" disabled={shipment.operationsStatus === "CLOSE_READY" || !!shipment.closedAt || requiredMissingCount > 0} variant="outline" size="sm">
                          Verify & Mark Close Ready
                        </Button>
                      </form>

                      <form action={closeJobAction}>
                        <input type="hidden" name="shipmentJobId" value={shipment.id} />
                        <Button type="submit" disabled={shipment.operationsStatus !== "CLOSE_READY" || !!shipment.closedAt || requiredMissingCount > 0} variant="default" size="sm">
                          Close Job
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {canViewCosting || canViewBilling ? (
        <section id="finance" className="space-y-4 scroll-mt-20">
          <Card id="finance-closeout">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>Finance Closeout</CardTitle>
                  <CardDescription>Customer receivables, vendor settlement, payment posting, final profit snapshot, and finance closeout status for this job.</CardDescription>
                </div>
                <Badge variant={financeBadgeVariant(shipment.financeCloseStatus)}>
                  {shipment.financeCloseStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 md:grid-cols-4">
                <SummaryPill label="Customer invoice total" value={financeSummary?.actualCustomerInvoiceTotal ?? billingTotals.invoiced} />
                <SummaryPill label="Customer paid total" value={financeSummary?.customerPaidTotal ?? billingTotals.customerPaid} />
                <SummaryPill label="Customer outstanding" value={financeSummary?.customerOutstanding ?? billingTotals.customerDue} />
                <SummaryPill label="Vendor bill total" value={financeSummary?.vendorBillTotal ?? billingTotals.vendorBilled} />
                <SummaryPill label="Vendor paid total" value={financeSummary?.vendorPaidTotal ?? billingTotals.vendorPaid} />
                <SummaryPill label="Vendor outstanding" value={financeSummary?.vendorOutstanding ?? billingTotals.vendorDue} />
                <SummaryPill label={isFinanceLocked ? "Final sell amount" : "Estimated sell amount"} value={finalOrEstimatedSell} />
                <SummaryPill label={isFinanceLocked ? "Final buy amount" : "Estimated buy amount"} value={finalOrEstimatedBuy} />
                <SummaryPill label="Gross profit" value={financeGrossProfit} danger={Number(financeGrossProfit) < 0} />
                <SummaryPill label="Profit margin" value={`${Number(financeProfitMargin).toFixed(2)}%`} />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">Close blockers</p>
                <p className="mt-1 text-xs text-slate-500">Next: review receivable and payable readiness before finance lock.</p>
                {financeSummary?.blockers.length ? (
                  <ul className="mt-3 grid gap-2 text-sm text-red-700 md:grid-cols-2">
                    {financeSummary.blockers.map((blocker) => (
                      <li key={blocker} className="rounded-md bg-red-50 px-3 py-2">
                        {financeBlockerLabel(blocker)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-emerald-700">No finance close blockers detected.</p>
                )}
              </div>

              {canUpdateCosting ? (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]">
                  <FinanceCloseExceptionsForm
                    action={updateFinanceCloseExceptionsAction}
                    shipmentJobId={shipment.id}
                    allowUnpaidReceivableClose={shipment.allowUnpaidReceivableClose}
                    vendorPayablesNotApplicable={shipment.vendorPayablesNotApplicable}
                    notes={shipment.financeCloseNotes}
                    disabled={isFinanceLocked}
                  />
                  <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Finance actions</p>
                    {isFinanceLocked ? (
                      <p className="text-sm text-slate-600">
                        Finance is locked. Final profit snapshot cannot be edited from this page.
                        Payment posting after lock remains allowed through normal payment workflows.
                      </p>
                    ) : (
                      <>
                        <FinanceCloseActionForm
                          action={markFinanceCloseReadyAction}
                          shipmentJobId={shipment.id}
                          label="Mark Finance Close Ready"
                          notes={shipment.financeCloseNotes}
                        />
                        <FinanceCloseActionForm
                          action={lockJobFinanceAction}
                          shipmentJobId={shipment.id}
                          label="Lock Finance / Finalize Profit"
                          notes={shipment.financeCloseNotes}
                        />
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Financial costings buy/sell */}
          {canViewCosting ? (
            <Card id="costing">
              <CardHeader>
                <CardTitle>Costing</CardTitle>
                <CardDescription>Buy/sell costing items for margin audit. This section is visible only to authorized costing users.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {hasNegativeProfit ? (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    Warning: this job currently has negative profit.
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-4">
                  <SummaryPill label="Total buy" value={shipment.totalBuyAmount} />
                  <SummaryPill label="Total sell" value={shipment.totalSellAmount} />
                  <SummaryPill label="Gross profit" value={shipment.grossProfit} danger={hasNegativeProfit} />
                  <SummaryPill label="Margin" value={`${Number(shipment.profitMarginPercent).toFixed(2)}%`} />
                </div>
                {canUpdateCosting ? (
                  <ShipmentCostForm
                    action={saveShipmentCostItem}
                    shipmentJobId={shipment.id}
                    vendors={costingVendors}
                    customers={costingCustomers}
                    quotations={costingQuotations}
                  />
                ) : null}
                <div className="overflow-hidden rounded-md border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Charge</th>
                        <th className="px-4 py-3">Vendor / Customer</th>
                        <th className="px-4 py-3">Buy / Sell</th>
                        <th className="px-4 py-3">Profit</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {shipment.costItems.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-950">{item.chargeName}</p>
                            <p className="text-xs text-slate-500">{item.chargeType} / {item.chargeBasis} / {item.currency}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <p>{item.vendor?.name ?? "-"}</p>
                            <p className="text-xs text-slate-400">{item.customer?.name ?? "-"}</p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <p>{formatMoney(item.buyAmount)}</p>
                            <p>{formatMoney(item.sellAmount)}</p>
                          </td>
                          <td className={Number(item.profitAmount) < 0 ? "px-4 py-3 text-red-600" : "px-4 py-3 text-emerald-700"}>
                            {formatMoney(item.profitAmount)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {canDeleteCosting ? (
                              <form action={deleteShipmentCostItem}>
                                <input type="hidden" name="id" value={item.id} />
                                <ConfirmDeleteButton label="Delete" message={`Delete cost item ${item.chargeName}?`} />
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                      {!shipment.costItems.length ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            No costing items added yet. Add cost and sell lines when pricing is ready.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Billing card */}
          {canViewBilling ? (
            <Card id="billing">
              <CardHeader>
                <CardTitle>Billing Summary</CardTitle>
                <CardDescription>Customer invoices and vendor bills converted to BDT for closeout review.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <SummaryPill label="Total invoiced" value={billingTotals.invoiced} />
                <SummaryPill label="Customer paid" value={billingTotals.customerPaid} />
                <SummaryPill label="Customer due" value={billingTotals.customerDue} />
                <SummaryPill label="Vendor billed" value={billingTotals.vendorBilled} />
                <SummaryPill label="Vendor paid" value={billingTotals.vendorPaid} />
                <SummaryPill label="Vendor due" value={billingTotals.vendorDue} />
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section id="client-portal" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Client Portal Configuration</CardTitle>
            <CardDescription>Portal links, single-use activation tokens, and shares tracking.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <DetailItem label="Portal Slug">
              <span className="font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-xs">
                {shipment.company.portalSlug ?? "disabled"}
              </span>
            </DetailItem>
            <DetailItem label="Secure Access Share Link">
              <a href={shareLink} target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-medium hover:underline">
                {shareLink}
              </a>
            </DetailItem>
            <p className="text-xs text-slate-500 mt-2">
              Note: Portal users will see a customer-safe view of routing dates, milestones, and shared files. Internal costing data, profits, margins, and carrier proposals are strictly locked out of portal paths for confidentiality.
            </p>
          </CardContent>
        </Card>
      </section>

      <section id="tasks" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Tasks Checklist</CardTitle>
                <CardDescription>Actionable tasks assigned for this shipment job file.</CardDescription>
              </div>
              {hasPermission(currentUser, "tasks:create") ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/dashboard/tasks/new?shipmentJobId=${shipment.id}&customerId=${shipment.customerId}&returnTo=/dashboard/shipments/${shipment.id}#tasks`}>
                    Add Task
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {shipmentTasks.map((task) => (
              <div key={task.id} className="rounded-md border border-slate-200 bg-white p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-slate-950">{task.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Assignee: {task.assignedUser?.name ?? "Unassigned"} | Priority: {task.priority} | Due: {dateValue(task.dueDate)}
                  </p>
                  {task.description && <p className="text-xs text-slate-600 mt-2">{task.description}</p>}
                </div>
                <Badge variant={task.status === "DONE" ? "success" : task.status === "IN_PROGRESS" ? "warning" : "secondary"}>
                  {task.status}
                </Badge>
              </div>
            ))}
            {!shipmentTasks.length ? (
              <div className="rounded-md border border-dashed border-slate-200 p-8 text-center text-slate-500 text-sm">
                No tasks logged for this shipment. Add a task when an owner, due date, or follow-up is needed.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      <section id="timeline" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Status Timeline</CardTitle>
            <CardDescription>
              Latest updates first. Chronological operational status updates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {canUpdateStatus ? (
              <ShipmentStatusForm
                action={addShipmentStatus}
                shipmentJobId={shipment.id}
                shipmentType={shipment.shipmentType}
                statuses={statusFlow}
              />
            ) : null}
            <div className="space-y-3">
              {shipment.statusEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-slate-400" />
                      <Badge variant={badgeVariant(event.status)}>{event.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      {event.createdAt.toLocaleString()} by {event.updatedBy.name}
                    </p>
                  </div>
                  {event.remarks ? (
                    <p className="mt-3 text-sm text-slate-600">{event.remarks}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="audit" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>Latest shipment-level audit events.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-md border border-slate-200 p-3 text-sm">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <span className="font-medium text-slate-950">{log.action}</span>
                  <span className="text-slate-500">{log.createdAt.toLocaleString()}</span>
                </div>
                <div className="mt-2 grid gap-1 text-xs text-slate-500 md:grid-cols-3">
                  <span>Entity: {log.entityType}</span>
                  <span>Actor: {log.user?.name ?? log.user?.email ?? "-"}</span>
                  <span>Metadata: {log.metadata ? JSON.stringify(log.metadata) : "-"}</span>
                </div>
              </div>
            ))}
            {!auditLogs.length ? (
              <p className="rounded-md border border-slate-200 p-6 text-center text-sm text-slate-500">
                No audit entries yet.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {canUseAiCopilot ? (
        <section id="ai-copilot" className="grid gap-4 xl:grid-cols-2 scroll-mt-20">
          <AiShipmentSummaryCard shipmentId={shipment.id} />
          <AiShipmentAssistantPanel shipmentId={shipment.id} />
        </section>
      ) : null}
      </ShipmentDetailTabs>
    </main>
  );
}
