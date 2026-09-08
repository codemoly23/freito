import "server-only";
import { z } from "zod";
import { generateAIObject, type AIGatewayUser } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";

// The existing /api/search route (Phase 03 of the main plan) only does a
// plain substring match on a single `q` param -- there is no structured
// filter to parse into. So "Smart Search" adds one thing on top: turning a
// natural-language question into the short, literal keyword that substring
// search actually needs, then handing that keyword to the *same* per-entity
// search functions the route already has (see the `ai=1` branch in
// app/api/search/route.ts). No new data-access path is introduced here.
const smartSearchSchema = z.object({
  keyword: z
    .string()
    .describe("The single most distinctive literal word or phrase to search for -- a name, reference number, or code. Short, no extra words."),
});

const SMART_SEARCH_PROMPT_INTRO = `A user typed a natural-language question into a freight/logistics ERP's search box. The underlying search only does a literal substring match against these fields: customer (name, code, email, phone), vendor (name, email, phone), shipment (job number, MBL/HBL/MAWB/HAWB/booking number, shipper name, consignee name), quotation (quote number), invoice (invoice number), document (name/type). Extract the single most distinctive literal keyword or phrase from the user's question that is likely to appear verbatim in one of those fields -- typically a proper noun, reference number, or code. Ignore generic words like "delayed", "pending", "show me", "for". If nothing distinctive is present, return the shortest reasonable literal phrase from the question.`;

export async function parseSmartSearchQuery(user: AIGatewayUser, rawQuery: string) {
  return generateAIObject(
    user,
    aiFeatures.smartSearch,
    { prompt: `${SMART_SEARCH_PROMPT_INTRO}\n\nUser's question: "${rawQuery}"`, schema: smartSearchSchema },
    { entityType: "search" },
  );
}
