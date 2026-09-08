import type { ReactNode } from "react";

export type ReportScalar = string | number | boolean | null;

export type ReportFilterParams = Record<string, string | string[] | undefined>;

export type ParsedReportFilters = {
  from: Date;
  to: Date;
  fromInput: string;
  toInput: string;
  customerId?: string;
  vendorId?: string;
  transportMode?: "SEA" | "AIR" | "LAND";
  shipmentType?: "IMPORT" | "EXPORT";
  loadType?: "FCL" | "LCL" | "AIR_CARGO" | "TRUCK";
  serviceScope?: "PORT_TO_PORT" | "DOOR_TO_PORT" | "PORT_TO_DOOR" | "DOOR_TO_DOOR";
  status?: string;
  financeCloseStatus?: "OPEN" | "CLOSE_READY" | "LOCKED";
  salesPersonId?: string;
  operationsPersonId?: string;
};

export type ReportMetric = {
  label: string;
  value: ReactNode;
  detail?: string;
};

export type ManagementDashboardSummary = {
  totalShipments: number;
  openJobs: number;
  closedJobs: number;
  activeShipments: number;
  monthlyRevenue: number;
  monthlyGrossProfit: number;
  pendingReceivable: number;
  pendingPayable: number;
  financeClosePending: number;
  financeLockedJobs: number;
  deliveredButFinanceOpen: number;
  missingDocuments: number;
  delayedJobs: number;
  lowMarginJobs: number;
  lossMakingJobs: number;
};

export type FinanceProfitSummary = {
  totalSell: number;
  totalBuy: number;
  grossProfit: number;
  profitMarginPercent: number;
  finalSell: number;
  finalBuy: number;
  finalGrossProfit: number;
  finalProfitMarginPercent: number;
  receivableOutstanding: number;
  payableOutstanding: number;
  lockedJobCount: number;
  closeReadyJobCount: number;
  openFinanceJobCount: number;
  lowMarginJobCount: number;
  lossMakingJobCount: number;
};

export type ShipmentOperationSummary = {
  byMode: Record<string, number>;
  byShipmentType: Record<string, number>;
  byLoadType: Record<string, number>;
  byServiceScope: Record<string, number>;
  byStatus: Record<string, number>;
  byFinanceCloseStatus: Record<string, number>;
  topCustomers: { id: string; name: string; count: number }[];
  byOperationsPerson: { id: string; name: string; count: number }[];
};

export type DocumentStatusSummary = {
  totalDocuments: number;
  verifiedDocuments: number;
  rejectedDocuments: number;
  clientVisibleDocuments: number;
  missingDocumentCount: number;
  hblCount: number;
  hawbCount: number;
  manifestCount: number;
  customerDebitNoteCount: number;
  externalDocumentCount: number;
};

export type DeliveryReleaseSummary = {
  deliveryOrderPending: number;
  customsReleasePending: number;
  gatePassPending: number;
  cargoReleased: number;
  deliveryScheduled: number;
  outForDelivery: number;
  delivered: number;
  podPending: number;
  podVerified: number;
  jobCloseReady: number;
  jobClosed: number;
};
