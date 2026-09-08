import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { generateAIObject, type AIGatewayUser } from "@/lib/ai/gateway";
import { getDocumentExtraction, type DocumentReaderFailureReason } from "@/lib/ai/document-reader";
import { aiFeatures } from "@/lib/ai/features";

// Reuses Phase 3's getDocumentExtraction() rather than re-reading the file,
// then asks the model to compare the extracted text against the shipment's
// own record fields. Informational only -- this never verifies/rejects a
// document, it just surfaces a flagged issue list for a human to review.
const issueSchema = z.object({
  field: z.string(),
  severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
  issue: z.string(),
  shipmentRecordValue: z.string().nullable(),
  documentValue: z.string().nullable(),
});
const checkerSchema = z.object({ issues: z.array(issueSchema) });

export type DocumentCheckerIssue = z.infer<typeof issueSchema>;
export type DocumentCheckerResult = z.infer<typeof checkerSchema>;
export type DocumentCheckerFailureReason = DocumentReaderFailureReason;

export type DocumentCheckerOutcome =
  | { ok: true; data: DocumentCheckerResult }
  | { ok: false; reason: DocumentCheckerFailureReason; message: string };

type ShipmentFacts = {
  jobNo: string;
  shipperName: string | null;
  consigneeName: string | null;
  notifyParty: string | null;
  notifyPartyName: string | null;
  originPort: string | null;
  destinationPort: string | null;
  mblNo: string | null;
  hblNo: string | null;
  mawbNo: string | null;
  hawbNo: string | null;
  bookingNo: string | null;
  packageCount: number | null;
  grossWeight: unknown;
  cargoDescription: string | null;
};

function shipmentFactsText(shipment: ShipmentFacts) {
  const line = (label: string, value: unknown) => `${label}: ${value ?? "-"}`;
  return [
    line("Job No", shipment.jobNo),
    line("Shipper", shipment.shipperName),
    line("Consignee", shipment.consigneeName),
    line("Notify Party", shipment.notifyPartyName ?? shipment.notifyParty),
    line("Origin Port", shipment.originPort),
    line("Destination Port", shipment.destinationPort),
    line("MBL No", shipment.mblNo),
    line("HBL No", shipment.hblNo),
    line("MAWB No", shipment.mawbNo),
    line("HAWB No", shipment.hawbNo),
    line("Booking No", shipment.bookingNo),
    line("Package Count", shipment.packageCount),
    line("Gross Weight", shipment.grossWeight),
    line("Cargo Description", shipment.cargoDescription),
  ].join("\n");
}

const CHECKER_PROMPT_INTRO = `You are reviewing a single uploaded freight document against the shipment's own system record. Compare every field visible on the document against the shipment record facts below. Report ONLY genuine mismatches (a value that actually conflicts) and missing mandatory fields expected on this type of document (e.g. an invoice missing an invoice number). Both the record and the document being blank on the same thing is NOT an issue -- only report it when you can point to an actual conflicting or missing value. Do not invent problems that aren't evidenced by the text. If everything looks consistent, return an empty issues array.`;

export async function checkShipmentDocument(user: AIGatewayUser, documentId: string): Promise<DocumentCheckerOutcome> {
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
    select: {
      documentName: true,
      documentType: true,
      shipmentjob: {
        select: {
          jobNo: true,
          shipperName: true,
          consigneeName: true,
          notifyParty: true,
          notifyPartyName: true,
          originPort: true,
          destinationPort: true,
          mblNo: true,
          hblNo: true,
          mawbNo: true,
          hawbNo: true,
          bookingNo: true,
          packageCount: true,
          grossWeight: true,
          cargoDescription: true,
        },
      },
    },
  });
  if (!document) return { ok: false, reason: "NOT_FOUND", message: "Document not found." };

  const extraction = await getDocumentExtraction(user, documentId);
  if (!extraction.ok) return extraction;

  const prompt = `${CHECKER_PROMPT_INTRO}

Document type: ${document.documentType} (${document.documentName})

Shipment record facts:
${shipmentFactsText(document.shipmentjob)}

Extracted document text:
${extraction.data.text || "(no text extracted)"}`;

  const result = await generateAIObject(
    user,
    aiFeatures.documentChecker,
    { prompt, schema: checkerSchema },
    { entityType: "shipmentdocument", entityId: documentId },
  );
  if (!result.ok) return { ok: false, reason: result.reason, message: result.message };
  return { ok: true, data: result.data };
}
