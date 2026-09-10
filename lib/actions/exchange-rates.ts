"use server";

import { z } from "zod";
import { requirePlatformPermission } from "@/lib/permissions/rbac";
import { upsertExchangeRate } from "@/lib/accounting/exchange-rates";
import {
  type ActionState,
  getFormData,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";
import { revalidatePath } from "next/cache";

const exchangeRateSchema = z.object({
  currency: z.enum(["BDT", "USD", "EUR", "GBP", "CNY", "INR", "AED", "RUB", "OTHER"]),
  rateToUSD: z.coerce.number().positive("Rate must be greater than zero."),
  effectiveDate: z.coerce.date(),
});

export async function saveExchangeRate(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  await requirePlatformPermission("platform:companies:update");

  const parsed = exchangeRateSchema.safeParse({
    currency: getString(formData, "currency"),
    rateToUSD: getString(formData, "rateToUSD"),
    effectiveDate: getString(formData, "effectiveDate"),
  });
  if (!parsed.success) {
    return validationError("Please fix the exchange rate fields.", parsed.error.flatten().fieldErrors);
  }

  await upsertExchangeRate(parsed.data);
  revalidatePath("/platform/exchange-rates");
  return successState(`Rate saved: 1 ${parsed.data.currency} = ${parsed.data.rateToUSD} USD.`);
}
