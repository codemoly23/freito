import {
  DEBIT_NOTE_SECTION_KEYS,
  documentTemplateLayoutSchemas,
  HAWB_SECTION_KEYS,
  HBL_SECTION_KEYS,
  INVOICE_SECTION_KEYS,
  MANIFEST_SECTION_KEYS,
  QUOTATION_SECTION_KEYS,
  type DocumentTemplateType,
} from "@/lib/validators/document-templates";

export const SECTION_KEYS_BY_TYPE = {
  QUOTATION: QUOTATION_SECTION_KEYS,
  INVOICE: INVOICE_SECTION_KEYS,
  HBL: HBL_SECTION_KEYS,
  HAWB: HAWB_SECTION_KEYS,
  DEBIT_NOTE: DEBIT_NOTE_SECTION_KEYS,
  MANIFEST: MANIFEST_SECTION_KEYS,
} as const;

export const SECTION_LABELS: Record<DocumentTemplateType, Record<string, string>> = {
  QUOTATION: {
    "quotation-details": "Quotation details",
    cargo: "Cargo",
    charges: "Charges",
    total: "Total",
    notes: "Customer notes and terms",
    "prepared-by": "Prepared by",
  },
  INVOICE: {
    "invoice-details": "Invoice details",
    "line-items": "Line items",
    totals: "Totals",
    "payment-notes": "Payment instructions / notes",
    "prepared-by": "Prepared by",
  },
  HBL: {
    parties: "Shipper / consignee / notify party",
    routing: "Vessel & routing (pre-carriage, POL, POD)",
    delivery: "Place of delivery / final destination",
    cargo: "Cargo table",
    terms: "Freight terms, B/L count, issue & signature",
  },
  HAWB: {
    parties: "Shipper / consignee / notify party",
    routing: "Airport routing",
    flight: "Flight number & date",
    cargo: "Cargo table",
    authorization: "Nature of goods & authorization",
  },
  DEBIT_NOTE: {
    "billing-info": "Billed to & document references",
    routing: "Origin / destination / transport mode",
    charges: "Charge table",
    totals: "Totals & payment instructions",
    authorization: "Prepared by & authorization",
  },
  MANIFEST: {
    "manifest-info": "Manifest number & references",
    routing: "Transport / routing",
    parties: "Shipper & consignee",
    "cargo-summary": "Cargo summary",
    commodity: "Commodity & HS code",
    "line-items": "Consolidation line items",
    remarks: "Marks & remarks",
    authorization: "Prepared by & authorization",
  },
};

/** The only tokens a custom note template may reference -- resolved by plain
 * string substitution, never HTML/expression evaluation. An unknown
 * `{{token}}` is left as literal text rather than silently dropped. */
export const ALLOWED_PLACEHOLDERS = ["companyName", "customerName", "documentNo", "documentDate"] as const;
export type AllowedPlaceholder = (typeof ALLOWED_PLACEHOLDERS)[number];

export type ResolvedDocumentLayout<K extends string = string> = {
  sections: { order: K[]; hidden: K[] };
  customNoteText?: string;
};

export function parseDocumentTemplateLayout(documentType: DocumentTemplateType, raw: string): ResolvedDocumentLayout | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = documentTemplateLayoutSchemas[documentType].safeParse(parsed);
  return result.success ? result.data : null;
}

/** Reconciles a layout against the current section registry for a document
 * type: unknown/removed keys are dropped, missing (newly added) sections are
 * appended in default order, and hidden sections are filtered out. With no
 * layout at all, this returns every section in its original default order --
 * i.e. identical to the pre-Phase-08 hardcoded PDF output. */
export function resolveSectionOrder<K extends string>(allKeys: readonly K[], layout?: ResolvedDocumentLayout<K> | null): K[] {
  if (!layout) return [...allKeys];
  const hiddenSet = new Set(layout.sections.hidden);
  const orderedKnown = layout.sections.order.filter((key) => (allKeys as readonly string[]).includes(key));
  const missing = allKeys.filter((key) => !orderedKnown.includes(key));
  return [...orderedKnown, ...missing].filter((key) => !hiddenSet.has(key));
}

export function resolveCustomNoteText(
  layout: ResolvedDocumentLayout | null | undefined,
  defaultText: string,
  values: Record<AllowedPlaceholder, string>,
): string {
  const template = layout?.customNoteText?.trim();
  if (!template) return defaultText;
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) =>
    (ALLOWED_PLACEHOLDERS as readonly string[]).includes(key) ? values[key as AllowedPlaceholder] : match,
  );
}
