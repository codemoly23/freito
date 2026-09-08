import { prisma } from "@/lib/db/prisma";
import { requireReportsPage } from "@/lib/reports/access";
import { buildShipmentReportWhere, parseReportFilters } from "@/lib/reports/filters";
import type { ReportFilterParams, ShipmentOperationSummary } from "@/lib/reports/types";

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    const value = String(row[key] ?? "Not set");
    totals[value] = (totals[value] ?? 0) + 1;
    return totals;
  }, {});
}

export async function getShipmentOperationSummary(
  params: ReportFilterParams = {},
): Promise<ShipmentOperationSummary> {
  const { companyId } = await requireReportsPage("operations");
  const filters = parseReportFilters(params);

  const shipments = await prisma.shipmentjob.findMany({
    where: buildShipmentReportWhere(companyId, filters),
    select: {
      transportMode: true,
      shipmentType: true,
      loadType: true,
      serviceScope: true,
      currentStatus: true,
      financeCloseStatus: true,
      customer: { select: { id: true, name: true } },
      user_shipmentjob_assignedToIdTouser: { select: { id: true, name: true } },
    },
    take: 2000,
  });

  const customerTotals = new Map<string, { id: string; name: string; count: number }>();
  const operationsTotals = new Map<string, { id: string; name: string; count: number }>();
  shipments.forEach((shipment) => {
    const customer = customerTotals.get(shipment.customer.id) ?? {
      id: shipment.customer.id,
      name: shipment.customer.name,
      count: 0,
    };
    customer.count += 1;
    customerTotals.set(customer.id, customer);

    const assigned = operationsTotals.get(shipment.user_shipmentjob_assignedToIdTouser.id) ?? {
      id: shipment.user_shipmentjob_assignedToIdTouser.id,
      name: shipment.user_shipmentjob_assignedToIdTouser.name,
      count: 0,
    };
    assigned.count += 1;
    operationsTotals.set(assigned.id, assigned);
  });

  return {
    byMode: countBy(shipments, "transportMode"),
    byShipmentType: countBy(shipments, "shipmentType"),
    byLoadType: countBy(shipments, "loadType"),
    byServiceScope: countBy(shipments, "serviceScope"),
    byStatus: countBy(shipments, "currentStatus"),
    byFinanceCloseStatus: countBy(shipments, "financeCloseStatus"),
    topCustomers: [...customerTotals.values()].sort((a, b) => b.count - a.count).slice(0, 10),
    byOperationsPerson: [...operationsTotals.values()].sort((a, b) => b.count - a.count).slice(0, 10),
  };
}
