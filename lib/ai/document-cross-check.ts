import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { generateAIObject, type AIGatewayUser } from "@/lib/ai/gateway";
import { getDocumentExtraction, type DocumentReaderFailureReason } from "@/lib/ai/document-reader";
import { aiFeatures } from "@/lib/ai/features";

const crossCheckIssueSchema = z.object({
  field: z.string(),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
  issue: z.string(),
  valuesByDocument: z.array(z.object({ documentLabel: z.string(), value: z.string().nullable() })),
});
const crossCheckSchema = z.object({ issues: z.array(crossCheckIssueSchema) });

export type DocumentCrossCheckIssue = z.infer<typeof crossCheckIssueSchema>;
export type DocumentCrossCheckResult = z.infer<typeof crossCheckSchema>;
export type DocumentCrossCheckFailureReason = "NOT_FOUND" | "NOT_ENOUGH_DOCUMENTS" | DocumentReaderFailureReason;

export type DocumentCrossCheckOutcome =
  | { ok: true; data: DocumentCrossCheckResult }
  | { ok: false; reason: DocumentCrossCheckFailureReason; message: string };

// Capped so one click can't fan out into an unbounded number of extraction
// calls (each document read is its own AI call against the daily cap).
const MAX_DOCUMENTS = 5;

const CROSS_CHECK_PROMPT_INTRO = `You are comparing multiple freight documents that belong to the same shipment. Each document's extracted text is shown below, labeled by its document name. Identify fields that should logically match across these documents (such as shipper, consignee, quantity, weight, PO number, container number, dates) but actually have conflicting values on different documents. For each conflict, list the value found on each document using the exact document label given below. Do not report a field as a conflict if it's simply missing/blank on some documents but consistent wherever it does appear. Do not invent data. If everything is consistent, return an empty issues array.`;

export async function crossCheckShipmentDocuments(user: AIGatewayUser, shipmentJobId: string): Promise<DocumentCrossCheckOutcome> {
  if (!user.companyId) {
    return { ok: false, reason: "FORBIDDEN", message: "AI features require a company-scoped account." };
  }

  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId: user.companyId,
    permissions: user.permissions ?? [],
  });

  const shipment = await prisma.shipmentjob.findFirst({
    where: { id: shipmentJobId, companyId: user.companyId, deletedAt: null, ...branchScopeWhere(accessibleBranchIds) },
    select: { id: true },
  });
  if (!shipment) return { ok: false, reason: "NOT_FOUND", message: "Shipment not found." };

  const documents = await prisma.shipmentdocument.findMany({
    where: {
      shipmentJobId,
      companyId: user.companyId,
      deletedAt: null,
      filePath: { not: null },
      status: { in: ["UPLOADED", "VERIFIED"] },
    },
    select: { id: true, documentName: true, version: true },
    orderBy: { version: "desc" },
  });

  const latestByName = new Map<string, (typeof documents)[number]>();
  for (const document of documents) {
    const key = document.documentName.toLowerCase();
    if (!latestByName.has(key)) latestByName.set(key, document); // already ordered by version desc
  }
  const candidates = Array.from(latestByName.values()).slice(0, MAX_DOCUMENTS);
  if (candidates.length < 2) {
    return { ok: false, reason: "NOT_ENOUGH_DOCUMENTS", message: "At least two uploaded documents are required to cross-check." };
  }

  // Sequential, not Promise.all -- keeps the daily-quota check's read-then-audit
  // window from racing across several parallel calls from one button click.
  const extractions: Awaited<ReturnType<typeof getDocumentExtraction>>[] = [];
  for (const document of candidates) {
    extractions.push(await getDocumentExtraction(user, document.id));
  }
  const failedIndex = extractions.findIndex((extraction) => !extraction.ok);
  if (failedIndex !== -1) {
    const failed = extractions[failedIndex];
    if (!failed.ok) {
      return {
        ok: false,
        reason: failed.reason,
        message: `Could not read "${candidates[failedIndex].documentName}": ${failed.message}`,
      };
    }
  }

  const sections = candidates
    .map((document, index) => {
      const extraction = extractions[index];
      const text = extraction.ok ? extraction.data.text : "";
      return `Document "${document.documentName}":\n${text || "(no text extracted)"}`;
    })
    .join("\n\n---\n\n");

  const prompt = `${CROSS_CHECK_PROMPT_INTRO}\n\n${sections}`;

  const result = await generateAIObject(
    user,
    aiFeatures.documentCrossCheck,
    { prompt, schema: crossCheckSchema },
    { entityType: "shipmentjob", entityId: shipmentJobId },
  );
  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return { ok: true, data: result.data };
}
