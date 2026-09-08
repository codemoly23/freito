"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";
import { aiEncryptionAvailable, encryptAiApiKey } from "@/lib/ai/encryption";
import { generateAIText } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";
import { prisma } from "@/lib/db/prisma";

export async function saveAiSettings(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const { user, companyId } = await getScopedCompanyId("ai:configure");

  const enabled = getString(formData, "enabled") === "true";
  const apiKey = getString(formData, "apiKey").trim();
  const clearApiKey = getString(formData, "clearApiKey") === "true";
  const dailyCapRaw = getString(formData, "dailyRequestCap").trim();
  const dailyRequestCap = dailyCapRaw ? Number(dailyCapRaw) : null;

  if (dailyRequestCap !== null && (!Number.isFinite(dailyRequestCap) || dailyRequestCap < 1)) {
    return validationError("Daily request cap must be a positive number, or left blank to use the platform default.");
  }

  let encryptedApiKey: string | null | undefined; // undefined = leave existing value untouched
  if (apiKey) {
    if (!aiEncryptionAvailable()) {
      return validationError(
        "AI_SECRET_KEY is not configured on the server. Ask your platform administrator to set it before saving a company API key.",
      );
    }
    encryptedApiKey = JSON.stringify(encryptAiApiKey(apiKey));
  } else if (clearApiKey) {
    encryptedApiKey = null;
  }

  await prisma.companyaisettings.upsert({
    where: { companyId },
    create: {
      id: crypto.randomUUID(),
      companyId,
      enabled,
      dailyRequestCap,
      encryptedApiKey: encryptedApiKey ?? null,
      updatedAt: new Date(),
    },
    update: {
      enabled,
      dailyRequestCap,
      ...(encryptedApiKey !== undefined ? { encryptedApiKey } : {}),
      updatedAt: new Date(),
    },
  });

  await audit({
    companyId,
    actorId: user.id,
    action: "AI_SETTINGS_UPDATED",
    entityType: "CompanyAiSettings",
    entityId: companyId,
    metadata: { enabled, dailyRequestCap, apiKeyChanged: encryptedApiKey !== undefined },
  });

  revalidatePath("/dashboard/settings/ai");
  return successState("AI settings saved.");
}

export async function testAiConnection() {
  const { user, companyId } = await getScopedCompanyId("ai:configure");

  const result = await generateAIText(
    { id: user.id, companyId, permissions: user.permissions },
    aiFeatures.foundationTest,
    'Reply with only the single word "OK".',
  );

  const lastTestResult = result.ok
    ? `OK: ${result.data.trim().slice(0, 200)}`
    : `Failed (${result.reason}): ${result.message}`;

  await prisma.companyaisettings.upsert({
    where: { companyId },
    create: { id: crypto.randomUUID(), companyId, lastTestedAt: new Date(), lastTestResult, updatedAt: new Date() },
    update: { lastTestedAt: new Date(), lastTestResult },
  });

  revalidatePath("/dashboard/settings/ai");
}
