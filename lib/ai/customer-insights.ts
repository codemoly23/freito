import "server-only";
import { prisma } from "@/lib/db/prisma";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { decimalToNumber } from "@/lib/reports/filters";
import { generateAIText, type AIGatewayFailureReason, type AIGatewayUser } from "@/lib/ai/gateway";
import { aiFeatures } from "@/lib/ai/features";

export type CustomerInsightsFailureReason = "NOT_FOUND" | "FORBIDDEN";

export type CustomerInsightsResult =
  | { ok: true; data: string }
  | { ok: false; reason: CustomerInsightsFailureReason | AIGatewayFailureReason; message: string };

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// customer has no branchId of its own -- it's a company-wide entity -- so
// cross-branch scoping happens on its child records (shipments/invoices/
// quotations) instead, exactly the same branchScopeWhere used everywhere else.
function marginBucket(avgMargin: number | null): string {
  if (avgMargin === null) return "Unknown (no costed shipments yet)";
  if (avgMargin < 0) return "Loss-making on average";
  if (avgMargin < 10) return "Thin margin (below 10%)";
  return "Healthy margin";
}

function roundToNearestThousand(value: number) {
  return Math.round(value / 1000) * 1000;
}

function profitMarginFor(shipment: { financeCloseStatus: string; profitMarginPercent: unknown; finalProfitMarginPercent: unknown }) {
  return decimalToNumber(shipment.financeCloseStatus === "LOCKED" ? shipment.finalProfitMarginPercent : shipment.profitMarginPercent);
}

export async function getCustomerInsights(user: AIGatewayUser, customerId: string): Promise<CustomerInsightsResult> {
  if (!user.companyId) {
    return { ok: false, reason: "FORBIDDEN", message: "AI features require a company-scoped account." };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: user.companyId, deletedAt: null },
    select: { name: true, status: true, createdAt: true },
  });
  if (!customer) {
    return { ok: false, reason: "NOT_FOUND", message: "Customer not found." };
  }

  const accessibleBranchIds = await getAccessibleBranchIds({
    userId: user.id,
    companyId: user.companyId,
    permissions: user.permissions ?? [],
  });
  const branchWhere = branchScopeWhere(accessibleBranchIds);
  const ninetyDaysAgo = new Date(Date.now() - NINETY_DAYS_MS);

  const [shipments, invoices, quotations] = await Promise.all([
    prisma.shipmentjob.findMany({
      where: { customerId, companyId: user.companyId, deletedAt: null, ...branchWhere },
      select: {
        createdAt: true,
        transportMode: true,
        originCountry: true,
        destinationCountry: true,
        financeCloseStatus: true,
        profitMarginPercent: true,
        finalProfitMarginPercent: true,
      },
      take: 300,
    }),
    prisma.invoice.findMany({
      where: { customerId, companyId: user.companyId, deletedAt: null, status: { not: "CANCELLED" }, ...branchWhere },
      select: { totalAmount: true, dueAmount: true, exchangeRateToBDT: true, dueDate: true, status: true },
      take: 300,
    }),
    prisma.quotation.findMany({
      where: { customerId, companyId: user.companyId, deletedAt: null, ...branchWhere },
      select: { status: true, transportMode: true, originCountry: true, destinationCountry: true },
      take: 300,
    }),
  ]);

  const totalShipments = shipments.length;
  const shipmentsLast90Days = shipments.filter((s) => s.createdAt >= ninetyDaysAgo).length;

  const routeCounts = new Map<string, number>();
  for (const s of shipments) {
    if (!s.originCountry || !s.destinationCountry) continue;
    const key = `${s.originCountry} -> ${s.destinationCountry} (${s.transportMode ?? "?"})`;
    routeCounts.set(key, (routeCounts.get(key) ?? 0) + 1);
  }
  const topRoutes = [...routeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([route, count]) => `${route}: ${count} shipment(s)`);

  const quotedRouteKeys = new Set<string>();
  for (const q of quotations) {
    if (!q.originCountry || !q.destinationCountry) continue;
    quotedRouteKeys.add(`${q.originCountry} -> ${q.destinationCountry} (${q.transportMode ?? "?"})`);
  }
  const quotedNotShipped = [...quotedRouteKeys].filter((route) => !routeCounts.has(route)).slice(0, 3);

  // Bucketed, never an exact percentage or raw shipment-level figure -- this
  // is the "redact/aggregate sensitive financial figures" step the plan calls for.
  const margins = shipments.map(profitMarginFor).filter((m) => m !== 0);
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null;

  const totalInvoices = invoices.length;
  const overdueInvoices = invoices.filter(
    (inv) => inv.status === "OVERDUE" || (inv.dueDate !== null && inv.dueDate < new Date() && decimalToNumber(inv.dueAmount) > 0),
  );
  const totalInvoicedBDT = invoices.reduce(
    (sum, inv) => sum + decimalToNumber(inv.totalAmount) * decimalToNumber(inv.exchangeRateToBDT),
    0,
  );
  const totalOverdueBDT = overdueInvoices.reduce(
    (sum, inv) => sum + decimalToNumber(inv.dueAmount) * decimalToNumber(inv.exchangeRateToBDT),
    0,
  );
  const onTimeRate = totalInvoices ? Math.round(((totalInvoices - overdueInvoices.length) / totalInvoices) * 100) : null;

  const accepted = quotations.filter((q) => q.status === "ACCEPTED" || q.status === "CONVERTED").length;
  const decided = accepted + quotations.filter((q) => q.status === "REJECTED" || q.status === "EXPIRED").length;
  const acceptanceRate = decided ? Math.round((accepted / decided) * 100) : null;

  const promptBlock = [
    `Customer: ${customer.name} (status: ${customer.status}, customer since ${customer.createdAt.toISOString().slice(0, 10)})`,
    `Total shipments: ${totalShipments} (${shipmentsLast90Days} in the last 90 days)`,
    `Top shipped routes: ${topRoutes.length ? topRoutes.join("; ") : "None yet"}`,
    `Quoted but never shipped routes (potential upsell): ${quotedNotShipped.length ? quotedNotShipped.join("; ") : "None"}`,
    `Average shipment margin: ${marginBucket(avgMargin)}`,
    `Invoices: ${totalInvoices} total, ${overdueInvoices.length} currently overdue`,
    `Total invoiced (approx, BDT): ${totalInvoices ? roundToNearestThousand(totalInvoicedBDT) : 0}`,
    `Total overdue (approx, BDT): ${overdueInvoices.length ? roundToNearestThousand(totalOverdueBDT) : 0}`,
    `On-time payment rate: ${onTimeRate === null ? "No invoices yet" : `${onTimeRate}%`}`,
    `Quotation acceptance rate: ${acceptanceRate === null ? "Not enough decided quotations yet" : `${acceptanceRate}%`}`,
  ].join("\n");

  const prompt = `Summarize this customer's relationship with our freight forwarding company in 3-5 short sentences for an internal sales/operations user. Cover their activity trend, payment reliability, and one potential upsell route/lane if the data suggests one. Only use the facts given below -- do not invent numbers, routes, or details not present, and do not restate figures more precisely than given (amounts below are already rounded).\n\n${promptBlock}`;

  return generateAIText(user, aiFeatures.customerInsights, prompt, {
    entityType: "customer",
    entityId: customerId,
  });
}
