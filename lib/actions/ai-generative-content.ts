"use server";

import { getScopedCompanyId } from "@/lib/actions/helpers";
import { getShipmentEmailDraft, type EmailPurpose } from "@/lib/ai/email-generator";
import { getQuotationChargeDraft, type QuotationChargeDraft, type QuotationDraftInput } from "@/lib/ai/quotation-generator";

export type EmailDraftActionResult = { ok: true; subject: string; body: string } | { ok: false; message: string };

// Called directly (not form-bound) from AiEmailDraftButton. Gated by
// "shipments:view", the same permission that gates the shipment detail page
// this button lives on. The draft is never sent from here -- it only fills a
// mailto: link the user still has to send themselves from their own client.
export async function generateShipmentEmailDraftAction(
  shipmentId: string,
  purpose: EmailPurpose,
): Promise<EmailDraftActionResult> {
  const { user, companyId } = await getScopedCompanyId("shipments:view");

  const result = await getShipmentEmailDraft({ id: user.id, companyId, permissions: user.permissions }, shipmentId, purpose);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, subject: result.data.subject, body: result.data.body };
}

export type QuotationDraftActionResult =
  | { ok: true; charges: QuotationChargeDraft[]; referenceCount: number }
  | { ok: false; message: string };

// Called directly from the "Generate with AI" button on the quotation create
// form. Gated by "quotations:create" -- the same permission required to reach
// that form. Only returns a draft; saveQuotation (untouched) still requires
// the user to review and submit the form themselves.
export async function generateQuotationChargeDraftAction(input: QuotationDraftInput): Promise<QuotationDraftActionResult> {
  const { user, companyId } = await getScopedCompanyId("quotations:create");

  const result = await getQuotationChargeDraft({ id: user.id, companyId, permissions: user.permissions }, input);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, charges: result.data, referenceCount: result.referenceCount };
}
