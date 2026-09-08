import "server-only";
import type { ModelMessage } from "ai";
import type { ZodType } from "zod";
import { audit } from "@/lib/actions/helpers";
import { decryptAiApiKey } from "@/lib/ai/encryption";
import { generateProviderObject, generateProviderText, streamProviderText, type AIProviderKey } from "@/lib/ai/client";
import type { AIFeature } from "@/lib/ai/features";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";

// The single entrypoint every AI feature must call. Nothing outside this
// file (and lib/ai/client.ts) may import the provider SDK directly, so
// platform kill-switch, company enable/disable, permission, and the daily
// cost cap are always enforced the same way, and every successful call is
// audited the same way.
export type AIGatewayUser = {
  id: string;
  companyId?: string | null;
  permissions?: string[];
};

export type AIGatewayFailureReason =
  | "PLATFORM_DISABLED"
  | "COMPANY_DISABLED"
  | "FORBIDDEN"
  | "NOT_CONFIGURED"
  | "QUOTA_EXCEEDED"
  | "PROVIDER_ERROR";

export type AIGatewayResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: AIGatewayFailureReason; message: string };

const DEFAULT_DAILY_CAP = 200;
const DEFAULT_PROVIDER: AIProviderKey = "GEMINI";

function platformEnabled() {
  return process.env.AI_ENABLED === "true";
}

function platformApiKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || undefined;
}

function platformDefaultProvider(): AIProviderKey {
  const value = process.env.AI_PROVIDER?.trim().toUpperCase();
  return value === "OPENAI" || value === "ANTHROPIC" ? value : DEFAULT_PROVIDER;
}

async function resolveCompanySettings(companyId: string) {
  const row = await prisma.companyaisettings.findUnique({ where: { companyId } });
  const provider = row?.provider ?? platformDefaultProvider();
  const dailyCap = row?.dailyRequestCap ?? Number(process.env.AI_DEFAULT_DAILY_REQUEST_CAP ?? DEFAULT_DAILY_CAP);
  const apiKey = row?.encryptedApiKey ? decryptAiApiKey(JSON.parse(row.encryptedApiKey)) : platformApiKey();
  return {
    companyEnabled: row?.enabled ?? false,
    provider: provider as AIProviderKey,
    dailyCap,
    apiKey,
  };
}

async function withinDailyQuota(companyId: string, dailyCap: number) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.auditlog.count({
    where: { companyId, action: "AI_GENERATE", createdAt: { gte: startOfDay } },
  });
  return usedToday < dailyCap;
}

// Shared pre-flight checks (platform kill-switch -> company enable -> permission
// -> API key configured -> daily cap). Used by both the await-the-full-result
// path (runGateway) and the streaming path (generateAIStreamText), since a
// stream must be gated the same way before the response starts.
type ResolvedGate = { companyId: string; apiKey: string; provider: AIProviderKey };
type GateFailure = { ok: false; reason: AIGatewayFailureReason; message: string };

async function resolveGate(user: AIGatewayUser): Promise<{ ok: true; gate: ResolvedGate } | GateFailure> {
  if (!platformEnabled()) {
    return { ok: false, reason: "PLATFORM_DISABLED", message: "AI features are not enabled on this installation." };
  }
  if (!user.companyId) {
    return { ok: false, reason: "FORBIDDEN", message: "AI features require a company-scoped account." };
  }
  if (!hasPermission(user, "ai:use")) {
    return { ok: false, reason: "FORBIDDEN", message: "You do not have permission to use AI features." };
  }

  const settings = await resolveCompanySettings(user.companyId);
  if (!settings.companyEnabled) {
    return { ok: false, reason: "COMPANY_DISABLED", message: "AI features are not enabled for this company." };
  }
  if (!settings.apiKey) {
    return { ok: false, reason: "NOT_CONFIGURED", message: "No AI provider API key is configured." };
  }
  if (!(await withinDailyQuota(user.companyId, settings.dailyCap))) {
    return { ok: false, reason: "QUOTA_EXCEEDED", message: "Daily AI request limit reached for this company." };
  }

  return { ok: true, gate: { companyId: user.companyId, apiKey: settings.apiKey, provider: settings.provider } };
}

function auditGeneration(companyId: string, actorId: string, feature: AIFeature, entity: { entityType?: string; entityId?: string }) {
  return audit({
    companyId,
    actorId,
    action: "AI_GENERATE",
    entityType: entity.entityType ?? feature,
    entityId: entity.entityId ?? null,
    metadata: { feature },
  });
}

async function runGateway<T>(
  user: AIGatewayUser,
  feature: AIFeature,
  entity: { entityType?: string; entityId?: string },
  call: (apiKey: string, provider: AIProviderKey) => Promise<T>,
): Promise<AIGatewayResult<T>> {
  const gated = await resolveGate(user);
  if (!gated.ok) return gated;

  let data: T;
  try {
    data = await call(gated.gate.apiKey, gated.gate.provider);
  } catch (error) {
    return {
      ok: false,
      reason: "PROVIDER_ERROR",
      message: error instanceof Error ? error.message : "AI provider request failed.",
    };
  }

  await auditGeneration(gated.gate.companyId, user.id, feature, entity);

  return { ok: true, data };
}

export async function generateAIText(
  user: AIGatewayUser,
  feature: AIFeature,
  prompt: string,
  entity: { entityType?: string; entityId?: string } = {},
): Promise<AIGatewayResult<string>> {
  return runGateway(user, feature, entity, (apiKey, provider) =>
    generateProviderText({ apiKey, provider, prompt }),
  );
}

export async function generateAIObject<T>(
  user: AIGatewayUser,
  feature: AIFeature,
  params: { prompt: string; schema: ZodType<T>; file?: { data: Buffer; mediaType: string } },
  entity: { entityType?: string; entityId?: string } = {},
): Promise<AIGatewayResult<T>> {
  return runGateway(user, feature, entity, (apiKey, provider) =>
    generateProviderObject<T>({ apiKey, provider, prompt: params.prompt, schema: params.schema, file: params.file }),
  );
}

// Streaming variant for the chat assistant. Unlike runGateway, this returns
// as soon as the pre-flight checks pass, without waiting for generation to
// finish -- the response streams to the client while it's still being
// generated. The audit entry (which the daily quota count depends on) is
// only written once the stream completes, in onFinish, so an aborted or
// failed stream never gets counted as a successful call.
export async function generateAIStreamText(
  user: AIGatewayUser,
  feature: AIFeature,
  params: { system?: string; messages: ModelMessage[] },
  entity: { entityType?: string; entityId?: string } = {},
): Promise<AIGatewayResult<ReturnType<typeof streamProviderText>>> {
  const gated = await resolveGate(user);
  if (!gated.ok) return gated;

  try {
    const stream = streamProviderText({
      apiKey: gated.gate.apiKey,
      provider: gated.gate.provider,
      system: params.system,
      messages: params.messages,
      onFinish: () => {
        auditGeneration(gated.gate.companyId, user.id, feature, entity).catch((error) => {
          console.error("[ai] failed to write audit log for streamed generation:", error);
        });
      },
    });
    return { ok: true, data: stream };
  } catch (error) {
    return {
      ok: false,
      reason: "PROVIDER_ERROR",
      message: error instanceof Error ? error.message : "AI provider request failed.",
    };
  }
}
