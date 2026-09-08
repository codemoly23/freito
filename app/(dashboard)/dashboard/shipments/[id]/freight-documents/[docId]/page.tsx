import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { FreightDocumentEditForm } from "@/components/forms/freight-document-forms";
import { FreightDocumentView } from "@/components/forms/freight-document-view";
import {
  updateFreightDocument,
  submitDocumentForReview,
  approveFreightDocument,
  lockFreightDocument,
  createDocumentAmendment,
  rejectDocumentReview,
} from "@/lib/actions/freight-documents";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PageProps = {
  params: Promise<{ id: string; docId: string }>;
};

export default async function FreightDocumentDetailPage({ params }: PageProps) {
  const currentUser = await requirePermission("documents:view");
  const { id: shipmentJobId, docId } = await params;

  // Retrieve the freight document scoped to the company
  const doc = await prisma.freightdocument.findFirst({
    where: {
      id: docId,
      shipmentJobId,
      companyId: currentUser.companyId || "",
      deletedAt: null,
    },
    include: {
      company: {
        select: {
          name: true,
          legalName: true,
          email: true,
          phone: true,
          address: true,
          logoPath: true,
          logoUpdatedAt: true,
        },
      },
      shipmentjob: { select: { jobNo: true } },
      documentversion: {
        orderBy: { versionNumber: "desc" },
        include: {
          user: { select: { name: true } },
        },
      },
      documentapproval: {
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true } },
          clientportalaccount: { select: { displayClientCode: true } },
        },
      },
    },
  });

  if (!doc) notFound();

  // For MANIFEST documents, fetch sibling HBL/HAWB docs from the same shipment
  // so the form can offer a Re-sync button
  const siblingDocs = doc.type === "MANIFEST" ? await prisma.freightdocument.findMany({
    where: {
      shipmentJobId,
      companyId: currentUser.companyId || "",
      deletedAt: null,
      type: { in: ["HBL", "HAWB"] }
    },
    select: {
      id: true,
      type: true,
      documentNo: true,
      status: true,
      documentversion: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        select: { content: true }
      }
    },
    orderBy: { createdAt: "asc" }
  }) : [];

  // Retrieve user roles for authorization checks (approvals/locking)
  const userRoles = await prisma.userrole.findMany({
    where: { userId: currentUser.id },
    include: { role: true },
  });

  const isAdminOrManager = userRoles.some(
    (ur) =>
      ur.role.code === "COMPANY_ADMIN" || ur.role.code === "OPERATIONS_MANAGER"
  );

  const isFinal = doc.status === "LOCKED" || doc.status === "VERIFIED";

  const formattedDoc = {
    ...doc,
    versions: doc.documentversion.map((v) => ({ ...v, createdBy: v.user })),
    approvals: doc.documentapproval.map((a) => ({ ...a, approvedBy: a.user, portalAccount: a.clientportalaccount })),
    shipmentJob: doc.shipmentjob,
  };

  const formattedSiblingDocs = siblingDocs.map((s) => ({
    ...s,
    versions: s.documentversion,
  }));

  return (
    <main className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {isFinal ? (
        <FreightDocumentView
          document={formattedDoc}
          amendAction={createDocumentAmendment}
          isAdminOrManager={isAdminOrManager}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Manage Freight Document</h1>
              <p className="text-xs text-slate-500">
                Edit, approve, lock, and track versions of {doc.documentNo}. Locked documents are read-only; use amendment workflow if changes are needed.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Client-visible documents can be shared to the portal. Internal documents remain backoffice-only.
              </p>
            </div>
            <Button asChild variant="outline">
              <a href={`/dashboard/shipments/${shipmentJobId}#freight-documents`}>
                Back to Shipment
              </a>
            </Button>
          </div>

          <FreightDocumentEditForm
            updateAction={updateFreightDocument}
            submitAction={submitDocumentForReview}
            approveAction={approveFreightDocument}
            lockAction={lockFreightDocument}
            amendAction={createDocumentAmendment}
            rejectAction={rejectDocumentReview}
            document={formattedDoc}
            siblingDocs={formattedSiblingDocs}
            isAdminOrManager={isAdminOrManager}
          />

        </div>
      )}
    </main>
  );
}
