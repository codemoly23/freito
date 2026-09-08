import { Prisma } from "@/lib/generated/prisma/client";
import { enumParam, firstParam, getReportDateRange } from "@/lib/reports/date-range";
import type { ParsedReportFilters, ReportFilterParams } from "@/lib/reports/types";

const transportModes = ["SEA", "AIR", "LAND"] as const;
const shipmentTypes = ["IMPORT", "EXPORT"] as const;
const loadTypes = ["FCL", "LCL", "AIR_CARGO", "TRUCK"] as const;
const serviceScopes = ["PORT_TO_PORT", "DOOR_TO_PORT", "PORT_TO_DOOR", "DOOR_TO_DOOR"] as const;
const financeCloseStatuses = ["OPEN", "CLOSE_READY", "LOCKED"] as const;

export function parseReportFilters(params: ReportFilterParams = {}): ParsedReportFilters {
  const range = getReportDateRange(params);
  return {
    ...range,
    customerId: firstParam(params.customerId),
    vendorId: firstParam(params.vendorId),
    transportMode: enumParam(params.transportMode, transportModes) as ParsedReportFilters["transportMode"],
    shipmentType: enumParam(params.shipmentType, shipmentTypes) as ParsedReportFilters["shipmentType"],
    loadType: enumParam(params.loadType, loadTypes) as ParsedReportFilters["loadType"],
    serviceScope: enumParam(params.serviceScope, serviceScopes) as ParsedReportFilters["serviceScope"],
    status: firstParam(params.status),
    financeCloseStatus: enumParam(params.financeCloseStatus, financeCloseStatuses) as ParsedReportFilters["financeCloseStatus"],
    salesPersonId: firstParam(params.salesPersonId),
    operationsPersonId: firstParam(params.operationsPersonId),
  };
}

export function buildShipmentReportWhere(
  companyId: string,
  filters: ParsedReportFilters,
): Prisma.shipmentjobWhereInput {
  return {
    companyId,
    deletedAt: null,
    createdAt: { gte: filters.from, lte: filters.to },
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.transportMode ? { transportMode: filters.transportMode } : {}),
    ...(filters.shipmentType ? { shipmentType: filters.shipmentType } : {}),
    ...(filters.loadType ? { loadType: filters.loadType } : {}),
    ...(filters.serviceScope ? { serviceScope: filters.serviceScope } : {}),
    ...(filters.status ? { currentStatus: filters.status } : {}),
    ...(filters.financeCloseStatus ? { financeCloseStatus: filters.financeCloseStatus } : {}),
    ...(filters.salesPersonId ? { createdById: filters.salesPersonId } : {}),
    ...(filters.operationsPersonId ? { assignedToId: filters.operationsPersonId } : {}),
  };
}

export function buildInvoiceReportWhere(
  companyId: string,
  filters: ParsedReportFilters,
): Prisma.invoiceWhereInput {
  return {
    companyId,
    deletedAt: null,
    invoiceDate: { gte: filters.from, lte: filters.to },
    status: { not: "CANCELLED" },
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
  };
}

export function buildVendorBillReportWhere(
  companyId: string,
  filters: ParsedReportFilters,
): Prisma.vendorbillWhereInput {
  return {
    companyId,
    deletedAt: null,
    billDate: { gte: filters.from, lte: filters.to },
    status: { not: "CANCELLED" },
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
  };
}

export function buildFreightDocumentReportWhere(
  companyId: string,
  filters: ParsedReportFilters,
): Prisma.freightdocumentWhereInput {
  return {
    companyId,
    deletedAt: null,
    createdAt: { gte: filters.from, lte: filters.to },
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.customerId ? { shipmentjob: { customerId: filters.customerId } } : {}),
  };
}

export function decimalToNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function sumBdt<T extends { exchangeRateToBDT: unknown }>(
  rows: T[],
  amount: (row: T) => unknown,
) {
  return rows.reduce((sum, row) => {
    const rate = decimalToNumber(row.exchangeRateToBDT) || 1;
    return sum + decimalToNumber(amount(row)) * rate;
  }, 0);
}
