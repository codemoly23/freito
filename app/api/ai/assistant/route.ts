import { NextResponse } from "next/server";
import type { ModelMessage } from "ai";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions/rbac";
import { generateAIStreamText, type AIGatewayFailureReason } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";
import { getShipmentAiContext, shipmentContextToPromptBlock } from "@/lib/ai/shipment-summary";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

type ChatMessage = { role: "user" | "assistant"; content: string };

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;
  const messages: ChatMessage[] = [];
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      (entry as { role?: unknown }).role !== "user" && (entry as { role?: unknown }).role !== "assistant" ||
      typeof (entry as { content?: unknown }).content !== "string"
    ) {
      return null;
    }
    const content = (entry as { content: string }).content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null;
    messages.push({ role: (entry as { role: "user" | "assistant" }).role, content });
  }
  return messages;
}

const gatewayStatus: Record<AIGatewayFailureReason, number> = {
  PLATFORM_DISABLED: 503,
  COMPANY_DISABLED: 503,
  NOT_CONFIGURED: 503,
  FORBIDDEN: 403,
  QUOTA_EXCEEDED: 429,
  PROVIDER_ERROR: 502,
};

// Streaming chat endpoint for the Shipment Assistant (Phase 5). The model
// never gets raw DB access -- everything it can talk about is pre-fetched,
// scoped to this one shipment (company + branch), and baked into the system
// prompt below, so it cannot answer with another company's or branch's data.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY" || !user.companyId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!hasPermission(user, "shipments:view") || !hasPermission(user, "ai:use")) {
    return NextResponse.json({ error: "You do not have permission to use the AI assistant." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const shipmentId = (body as { shipmentId?: unknown } | null)?.shipmentId;
  if (typeof shipmentId !== "string" || !shipmentId) {
    return NextResponse.json({ error: "shipmentId is required." }, { status: 400 });
  }

  const messages = parseMessages((body as { messages?: unknown } | null)?.messages);
  if (!messages) {
    return NextResponse.json({ error: "Invalid message history." }, { status: 400 });
  }

  const gatewayUser = { id: user.id, companyId: user.companyId, permissions: user.permissions };

  const context = await getShipmentAiContext(gatewayUser, shipmentId);
  if (!context.ok) {
    return NextResponse.json({ error: context.message }, { status: context.reason === "NOT_FOUND" ? 404 : 403 });
  }

  const system = `You are an internal shipment assistant for a freight forwarding company. Answer questions about ONLY the shipment described below. Never claim knowledge of other shipments, other customers, or other companies/branches -- you have not been given any such data. If asked about something outside this shipment's data, say you don't have that information. Keep answers short and specific.\n\n${shipmentContextToPromptBlock(context.data)}`;

  const modelMessages: ModelMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));

  const result = await generateAIStreamText(
    gatewayUser,
    aiFeatures.shipmentAssistant,
    { system, messages: modelMessages },
    { entityType: "shipmentjob", entityId: shipmentId },
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: gatewayStatus[result.reason] });
  }

  return result.data.toTextStreamResponse();
}
