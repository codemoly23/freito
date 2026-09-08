"use server";

import { getScopedCompanyId } from "@/lib/actions/helpers";
import { getDocumentExtraction, type ExtractedDocumentField } from "@/lib/ai/document-reader";

export type ExtractShipmentDocumentResult =
  | { ok: true; text: string; fields: ExtractedDocumentField[] }
  | { ok: false; message: string };

// Called directly (not form-bound) from AIExtractMarksButton's onClick, before
// the user sees the editable textarea. Gated by the same "shipments:update"
// permission as saveShipmentMarksAndNumbers, since that's the action this
// extraction ultimately feeds into.
export async function extractShipmentDocumentFields(documentId: string): Promise<ExtractShipmentDocumentResult> {
  const { user, companyId } = await getScopedCompanyId("shipments:update");

  const result = await getDocumentExtraction(
    { id: user.id, companyId, permissions: user.permissions },
    documentId,
  );

  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, text: result.data.text, fields: result.data.fields };
}
