// Central registry of AI feature keys used for gateway audit logging and
// (later phases) per-feature prompt building. Keeping every planned feature
// listed here up front means later phases only add a new file, not a new enum.
export const aiFeatures = {
  shipmentHealthScore: "SHIPMENT_HEALTH_SCORE",
  delayAlerts: "DELAY_ALERTS",
  profitAnalysis: "PROFIT_ANALYSIS",
  exceptionRadar: "EXCEPTION_RADAR",
  documentReader: "DOCUMENT_READER",
  documentChecker: "DOCUMENT_CHECKER",
  documentCrossCheck: "DOCUMENT_CROSS_CHECK",
  shipmentSummary: "SHIPMENT_SUMMARY",
  shipmentAssistant: "SHIPMENT_ASSISTANT",
  emailGenerator: "EMAIL_GENERATOR",
  quotationGenerator: "QUOTATION_GENERATOR",
  reportInsights: "REPORT_INSIGHTS",
  smartSearch: "SMART_SEARCH",
  taskSuggestions: "TASK_SUGGESTIONS",
  customerInsights: "CUSTOMER_INSIGHTS",
  foundationTest: "FOUNDATION_TEST",
} as const;

export type AIFeature = (typeof aiFeatures)[keyof typeof aiFeatures];
