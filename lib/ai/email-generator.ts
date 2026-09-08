import "server-only";
import { z } from "zod";
import { generateAIObject, type AIGatewayFailureReason, type AIGatewayUser } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";
import {
  getShipmentAiContext,
  shipmentContextToPromptBlock,
  type ShipmentContextFailureReason,
} from "@/lib/ai/shipment-summary";

export const EMAIL_PURPOSES = ["STATUS_UPDATE", "DELAY_NOTICE", "DOCUMENT_REQUEST"] as const;
export type EmailPurpose = (typeof EMAIL_PURPOSES)[number];

const draftSchema = z.object({
  subject: z.string(),
  body: z.string(),
});
export type EmailDraft = z.infer<typeof draftSchema>;

export type EmailDraftResult =
  | { ok: true; data: EmailDraft }
  | { ok: false; reason: ShipmentContextFailureReason | AIGatewayFailureReason; message: string };

const PURPOSE_INSTRUCTIONS: Record<EmailPurpose, string> = {
  STATUS_UPDATE:
    "Write a brief, professional status-update email to the customer about the current progress of their shipment. Be reassuring if it's on track; be direct but calm if there's a risk factor.",
  DELAY_NOTICE:
    "Write a professional email informing the customer of a delay on their shipment. Acknowledge the delay, reference the specific overdue item(s) given below as the reason, and reassure them it's being actively handled. Do not over-apologize.",
  DOCUMENT_REQUEST:
    "Write a professional email asking the customer to provide or correct the specific documents listed as rejected/missing below. Be clear about exactly what's needed and why.",
};

// Reuses Phase 5's shipment context builder (same scoped, pre-fetched data
// used for the Summary/Assistant) so the query logic isn't duplicated.
export async function getShipmentEmailDraft(
  user: AIGatewayUser,
  shipmentJobId: string,
  purpose: EmailPurpose,
): Promise<EmailDraftResult> {
  const context = await getShipmentAiContext(user, shipmentJobId);
  if (!context.ok) return context;

  const prompt = `Draft a customer-facing email about this freight shipment. ${PURPOSE_INSTRUCTIONS[purpose]}

The facts below are internal operations notes, labeled with internal tracking terms (e.g. "health score", "workflow steps"). Only use the underlying facts -- never use those internal labels/jargon in the email itself, and never mention internal costs or profit margins. Rephrase everything in plain, customer-appropriate business language (e.g. say "your shipment is progressing as expected" rather than listing that there are no overdue workflow steps; say "we're finalizing some paperwork on our end" rather than naming an internal blocked stage). Do not invent tracking numbers, dates, or details not present below. Address the customer by the company name given below in the greeting (e.g. "Dear ${context.data.customerName} team,") instead of a generic "Dear Customer". Keep it professional and concise, and end with a generic sign-off (e.g. "Best regards,") with no specific person's name.

${shipmentContextToPromptBlock(context.data)}`;

  return generateAIObject(user, aiFeatures.emailGenerator, { prompt, schema: draftSchema }, {
    entityType: "shipmentjob",
    entityId: shipmentJobId,
  });
}
