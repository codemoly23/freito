import "server-only";
import { prisma } from "@/lib/db/prisma";
import { decimalToNumber } from "@/lib/reports/filters";
import { hasPermission } from "@/lib/permissions/rbac";
import { requireReportsPage } from "@/lib/reports/access";

// Reuses the same locked-vs-current profit/margin selection as
// lib/reports/dashboard-summary.ts (kept as a small local copy rather than a
// shared export, so this file doesn't reach into that report's internals).
// Adds one thing the plain report doesn't: flagging shipments whose margin is
// well below the company's own historical average, not just a fixed 10%
// threshold.
export type LowMarginItem = {
  shipmentId: string;
  jobNo: string;
  customerName: string;
  profit: number;
  marginPercent: number;
  reason: string;
  href: string;
};

const LOW_MARGIN_THRESHOLD = 10;
const MAX_ITEMS = 15;

type ShipmentRow = {
  id: string;
  jobNo: string;
  financeCloseStatus: string;
  grossProfit: unknown;
  profitMarginPercent: unknown;
  finalGrossProfit: unknown;
  finalProfitMarginPercent: unknown;
  customer: { name: string };
};

function profitFor(shipment: ShipmentRow) {
  return decimalToNumber(shipment.financeCloseStatus === "LOCKED" ? shipment.finalGrossProfit : shipment.grossProfit);
}

function marginFor(shipment: ShipmentRow) {
  return decimalToNumber(shipment.financeCloseStatus === "LOCKED" ? shipment.finalProfitMarginPercent : shipment.profitMarginPercent);
}

export async function getLowMarginShipments(): Promise<{
  enabled: boolean;
  items: LowMarginItem[];
  companyAverageMargin: number;
}> {
  const { user, companyId, branchWhere } = await requireReportsPage("financial");
  if (!hasPermission(user, "reports:financial") || !hasPermission(user, "ai:use")) {
    return { enabled: false, items: [], companyAverageMargin: 0 };
  }

  const shipments = await prisma.shipmentjob.findMany({
    where: { companyId, deletedAt: null, totalSellAmount: { gt: 0 }, ...branchWhere },
    select: {
      id: true,
      jobNo: true,
      financeCloseStatus: true,
      grossProfit: true,
      profitMarginPercent: true,
      finalGrossProfit: true,
      finalProfitMarginPercent: true,
      customer: { select: { name: true } },
    },
    take: 3000,
  });

  const rows = shipments.map((shipment) => ({
    ...shipment,
    profit: profitFor(shipment),
    margin: marginFor(shipment),
  }));
  const companyAverageMargin = rows.length
    ? rows.reduce((sum, row) => sum + row.margin, 0) / rows.length
    : 0;
  const outlierThreshold = companyAverageMargin > 0 ? companyAverageMargin * 0.5 : 0;

  const items: LowMarginItem[] = [];
  for (const row of rows) {
    const isLoss = row.profit < 0;
    const isLowMargin = row.margin > 0 && row.margin < LOW_MARGIN_THRESHOLD;
    const isOutlier = !isLoss && !isLowMargin && companyAverageMargin > 0 && row.margin >= 0 && row.margin < outlierThreshold;
    if (!isLoss && !isLowMargin && !isOutlier) continue;

    items.push({
      shipmentId: row.id,
      jobNo: row.jobNo,
      customerName: row.customer.name,
      profit: row.profit,
      marginPercent: row.margin,
      reason: isLoss
        ? "Loss-making shipment"
        : isLowMargin
          ? "Profit margin is below 10%"
          : `Margin is well below the company average of ${companyAverageMargin.toFixed(1)}%`,
      href: `/dashboard/shipments/${row.id}`,
    });
  }

  items.sort((a, b) => a.marginPercent - b.marginPercent);
  return { enabled: true, items: items.slice(0, MAX_ITEMS), companyAverageMargin };
}
