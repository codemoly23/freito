"use server";

import { getScopedCompanyId } from "@/lib/actions/helpers";
import { getShipmentSummary } from "@/lib/ai/shipment-summary";

export type ShipmentSummaryActionResult = { ok: true; text: string } | { ok: false; message: string };

// Called directly (not form-bound) from AiShipmentSummaryCard's "Generate" /
// "Regenerate" button. Gated by "shipments:view" -- the same permission that
// gates the shipment detail page and its AI Copilot tab -- since the summary
// only ever surfaces read-only shipment state, nothing sensitive beyond that.
export async function generateShipmentSummary(shipmentId: string): Promise<ShipmentSummaryActionResult> {
  const { user, companyId } = await getScopedCompanyId("shipments:view");

  const result = await getShipmentSummary({ id: user.id, companyId, permissions: user.permissions }, shipmentId);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, text: result.data };
}
