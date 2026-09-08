import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { blobGet } from "@/lib/blob/client";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { generateAIObject, type AIGatewayFailureReason, type AIGatewayUser } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";

// Vision extraction is deliberately generic (label/value/confidence pairs),
// not "marks and numbers" specific, so Phase 4 (Document Checker / Cross-Check)
// can call getDocumentExtraction() and reuse the same field list instead of
// re-reading the file.
const extractionSchema = z.object({
  fields: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    }),
  ),
  text: z.string(),
});

export type ExtractedDocumentField = z.infer<typeof extractionSchema>["fields"][number];
export type DocumentExtractionResult = z.infer<typeof extractionSchema>;

export type DocumentReaderFailureReason = "NOT_FOUND" | "UNSUPPORTED_FILE" | AIGatewayFailureReason;

export type DocumentReaderResult =
  | { ok: true; data: DocumentExtractionResult }
  | { ok: false; reason: DocumentReaderFailureReason; message: string };

// Only formats Gemini can read as inline file data. Anything else (docx,
// xlsx, ...) fails fast with a clear message instead of an opaque provider
// error, and without spending a daily-quota call.
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const EXTRACTION_PROMPT = `You are reading an uploaded freight/shipping document (e.g. invoice, packing list, bill of lading, or similar). Identify every clearly labeled field visible on it -- such as shipper, consignee, marks and numbers, PO number, style number, carton/CTN numbers, invoice number, weight, quantity -- and return them as a list of {label, value, confidence}. Set confidence to LOW whenever the text is blurry, cut off, or you are inferring rather than reading it directly. Also return "text": a plain-text block with one "LABEL: value" line per field, in the order they appear on the document, ready to be used as freeform notes. If the file has no legible content, return an empty fields array and an empty text string. Do not invent data that is not visibly present on the document.`;

export async function getDocumentExtraction(
  user: AIGatewayUser,
  documentId: string,
): Promise<DocumentReaderResult> {
  if (!user.companyId) {
    return { ok: false, reason: "FORBIDDEN", message: "AI features require a company-scoped account." };
  }

  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId: user.companyId,
    permissions: user.permissions ?? [],
  });

  const document = await prisma.shipmentdocument.findFirst({
    where: {
      id: documentId,
      companyId: user.companyId,
      deletedAt: null,
      ...branchScopeWhere(accessibleBranchIds),
    },
    select: { filePath: true, mimeType: true },
  });
  if (!document?.filePath) {
    return { ok: false, reason: "NOT_FOUND", message: "Document not found." };
  }
  if (!document.mimeType || !SUPPORTED_MIME_TYPES.has(document.mimeType)) {
    return {
      ok: false,
      reason: "UNSUPPORTED_FILE",
      message: "This file type isn't supported for AI extraction. Supported: PDF, JPEG, PNG, WEBP.",
    };
  }

  const fileBuffer = await blobGet(document.filePath);
  if (!fileBuffer) {
    return { ok: false, reason: "UNSUPPORTED_FILE", message: "The uploaded file could not be read." };
  }

  const result = await generateAIObject(
    user,
    aiFeatures.documentReader,
    { prompt: EXTRACTION_PROMPT, schema: extractionSchema, file: { data: fileBuffer, mediaType: document.mimeType } },
    { entityType: "shipmentdocument", entityId: documentId },
  );

  if (!result.ok) {
    return { ok: false, reason: result.reason, message: result.message };
  }
  return { ok: true, data: result.data };
}
