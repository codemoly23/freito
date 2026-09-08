"use server";

import { getScopedCompanyId } from "@/lib/actions/helpers";
import { checkShipmentDocument, type DocumentCheckerIssue } from "@/lib/ai/document-checker";
import { crossCheckShipmentDocuments, type DocumentCrossCheckIssue } from "@/lib/ai/document-cross-check";

// Both actions are informational-only (no DB write) -- called directly from
// their button's onClick, gated by the same "shipments:update" permission as
// the document actions they sit next to.
export type CheckShipmentDocumentResult =
  | { ok: true; issues: DocumentCheckerIssue[] }
  | { ok: false; message: string };

export async function checkShipmentDocumentAction(documentId: string): Promise<CheckShipmentDocumentResult> {
  const { user, companyId } = await getScopedCompanyId("shipments:update");
  const result = await checkShipmentDocument({ id: user.id, companyId, permissions: user.permissions }, documentId);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, issues: result.data.issues };
}

export type CrossCheckShipmentDocumentsResult =
  | { ok: true; issues: DocumentCrossCheckIssue[] }
  | { ok: false; message: string };

export async function crossCheckShipmentDocumentsAction(shipmentJobId: string): Promise<CrossCheckShipmentDocumentsResult> {
  const { user, companyId } = await getScopedCompanyId("shipments:update");
  const result = await crossCheckShipmentDocuments({ id: user.id, companyId, permissions: user.permissions }, shipmentJobId);
  if (!result.ok) return { ok: false, message: result.message };
  return { ok: true, issues: result.data.issues };
}
