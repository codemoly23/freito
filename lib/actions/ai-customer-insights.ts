"use server";

import { getScopedCompanyId } from "@/lib/actions/helpers";
import { getCustomerInsights } from "@/lib/ai/customer-insights";

export type CustomerInsightsActionResult = { ok: true; text: string } | { ok: false; message: string };

// Called directly (not form-bound) from AiCustomerInsightsCard's "Generate"
// button. Gated by "customers:manage" -- the gateway separately enforces
// "ai:use" -- so both permissions from the plan end up required.
export async function generateCustomerInsights(customerId: string): Promise<CustomerInsightsActionResult> {
  const { user, companyId } = await getScopedCompanyId("customers:manage");

  const result = await getCustomerInsights({ id: user.id, companyId, permissions: user.permissions }, customerId);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }
  return { ok: true, text: result.data };
}
