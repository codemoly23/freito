import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { chargeBasisValues, chargeTypes, currencies, transportModes } from "@/lib/validators/finance";
import { generateAIObject, type AIGatewayFailureReason, type AIGatewayUser } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";

export type QuotationDraftInput = {
  transportMode: (typeof transportModes)[number];
  loadType?: string;
  originCountry: string;
  destinationCountry: string;
  cargoDescription?: string;
  packageCount?: number;
  grossWeight?: number;
  chargeableWeight?: number;
  cbm?: number;
};

// Same enum values as lib/validators/finance.ts's quotationChargeSchema, so a
// generated draft always parses cleanly through the existing saveQuotation
// action -- the AI never gets to invent a charge type/basis/currency the form
// doesn't support.
const chargeDraftSchema = z.object({
  chargeName: z.string(),
  chargeType: z.enum(chargeTypes),
  chargeBasis: z.enum(chargeBasisValues),
  currency: z.enum(currencies),
  quantity: z.number().positive(),
  buyRate: z.number().nonnegative(),
  sellRate: z.number().nonnegative(),
  remarks: z.string().optional(),
});
export type QuotationChargeDraft = z.infer<typeof chargeDraftSchema>;

const draftSchema = z.object({ charges: z.array(chargeDraftSchema).min(1).max(8) });

export type QuotationDraftResult =
  | { ok: true; data: QuotationChargeDraft[]; referenceCount: number }
  | { ok: false; reason: AIGatewayFailureReason; message: string };

const MAX_REFERENCE_QUOTATIONS = 5;

export async function getQuotationChargeDraft(
  user: AIGatewayUser,
  input: QuotationDraftInput,
): Promise<QuotationDraftResult> {
  if (!user.companyId) {
    return { ok: false, reason: "FORBIDDEN", message: "AI features require a company-scoped account." };
  }

  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId: user.companyId,
    permissions: user.permissions ?? [],
  });

  const pastQuotations = await prisma.quotation.findMany({
    where: {
      companyId: user.companyId,
      deletedAt: null,
      transportMode: input.transportMode,
      originCountry: input.originCountry,
      destinationCountry: input.destinationCountry,
      ...branchScopeWhere(accessibleBranchIds),
    },
    include: { quotationcharge: { where: { deletedAt: null } } },
    orderBy: { createdAt: "desc" },
    take: MAX_REFERENCE_QUOTATIONS,
  });

  const referenceLines = pastQuotations.flatMap((q) =>
    q.quotationcharge.map(
      (c) => `${c.chargeName} [${c.chargeType}/${c.chargeBasis}/${c.currency}]: buy ${c.buyRate}, sell ${c.sellRate}`,
    ),
  );

  const requirementBlock = [
    `Transport mode: ${input.transportMode}`,
    `Load type: ${input.loadType ?? "Not specified"}`,
    `Route: ${input.originCountry} -> ${input.destinationCountry}`,
    `Cargo description: ${input.cargoDescription || "Not specified"}`,
    `Package count: ${input.packageCount ?? "Not specified"}`,
    `Gross weight: ${input.grossWeight ?? "Not specified"}`,
    `Chargeable weight: ${input.chargeableWeight ?? "Not specified"}`,
    `CBM: ${input.cbm ?? "Not specified"}`,
  ].join("\n");

  const referenceBlock = referenceLines.length
    ? `Reference rates from this company's ${pastQuotations.length} most recent quotation(s) on this exact route and mode:\n${referenceLines.join("\n")}`
    : "No past quotations exist for this exact route and mode. Use standard freight-forwarding charge line items for this mode, but set every rate to 0 rather than guessing a number -- the user will fill in real rates.";

  const prompt = `Draft a freight quotation charge breakdown for the shipment requirement below, calibrated against the company's own historical rates when given. Use standard freight forwarding charge categories relevant to the transport mode (e.g. freight, origin handling, destination handling, customs, documentation). Do not invent a customer name or any detail not given below. Return 3-8 charge lines.\n\n${requirementBlock}\n\n${referenceBlock}`;

  const result = await generateAIObject(user, aiFeatures.quotationGenerator, { prompt, schema: draftSchema });
  if (!result.ok) return result;
  return { ok: true, data: result.data.charges, referenceCount: pastQuotations.length };
}
