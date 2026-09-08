import { z } from "zod";

export const QUOTATION_SECTION_KEYS = ["quotation-details", "cargo", "charges", "total", "notes", "prepared-by"] as const;
export const INVOICE_SECTION_KEYS = ["invoice-details", "line-items", "totals", "payment-notes", "prepared-by"] as const;
export const HBL_SECTION_KEYS = ["parties", "routing", "delivery", "cargo", "terms"] as const;
export const HAWB_SECTION_KEYS = ["parties", "routing", "flight", "cargo", "authorization"] as const;
export const DEBIT_NOTE_SECTION_KEYS = ["billing-info", "routing", "charges", "totals", "authorization"] as const;
export const MANIFEST_SECTION_KEYS = [
  "manifest-info",
  "routing",
  "parties",
  "cargo-summary",
  "commodity",
  "line-items",
  "remarks",
  "authorization",
] as const;

export type QuotationSectionKey = (typeof QUOTATION_SECTION_KEYS)[number];
export type InvoiceSectionKey = (typeof INVOICE_SECTION_KEYS)[number];
export type HblSectionKey = (typeof HBL_SECTION_KEYS)[number];
export type HawbSectionKey = (typeof HAWB_SECTION_KEYS)[number];
export type DebitNoteSectionKey = (typeof DEBIT_NOTE_SECTION_KEYS)[number];
export type ManifestSectionKey = (typeof MANIFEST_SECTION_KEYS)[number];
export type DocumentTemplateType = "QUOTATION" | "INVOICE" | "HBL" | "HAWB" | "DEBIT_NOTE" | "MANIFEST";

export const documentTemplateTypes: DocumentTemplateType[] = ["QUOTATION", "INVOICE", "HBL", "HAWB", "DEBIT_NOTE", "MANIFEST"];

/** Freight document types whose print layout is configurable through this
 * system. FreightDocument.type has many more values (MBL, PACKING_LIST, ...)
 * but only these four have a dedicated, code-defined print layout to begin
 * with -- the rest keep their existing generic fallback render untouched. */
export const FREIGHT_DOCUMENT_TEMPLATE_TYPES: DocumentTemplateType[] = ["HBL", "HAWB", "DEBIT_NOTE", "MANIFEST"];

export function isDocumentTemplateType(value: string): value is DocumentTemplateType {
  return (documentTemplateTypes as string[]).includes(value);
}

export const documentTemplateNameSchema = z.string().trim().min(1, "Name is required.").max(80, "Name is too long.");

const quotationLayoutSchema = z
  .object({
    sections: z
      .object({
        order: z.array(z.enum(QUOTATION_SECTION_KEYS)),
        hidden: z.array(z.enum(QUOTATION_SECTION_KEYS)),
      })
      .strict(),
    customNoteText: z.string().trim().max(500).optional(),
  })
  .strict();

const invoiceLayoutSchema = z
  .object({
    sections: z
      .object({
        order: z.array(z.enum(INVOICE_SECTION_KEYS)),
        hidden: z.array(z.enum(INVOICE_SECTION_KEYS)),
      })
      .strict(),
    customNoteText: z.string().trim().max(500).optional(),
  })
  .strict();

/** Freight document layouts (HBL/HAWB/DEBIT_NOTE/MANIFEST) are section
 * order/visibility only -- unlike Quotation/Invoice there is no free-text
 * placeholder slot in these print layouts, so `customNoteText` is not part
 * of this schema at all rather than being an accepted-but-unused field. */
function freightLayoutSchema<K extends readonly [string, ...string[]]>(keys: K) {
  return z
    .object({
      sections: z
        .object({
          order: z.array(z.enum(keys)),
          hidden: z.array(z.enum(keys)),
        })
        .strict(),
    })
    .strict();
}

const hblLayoutSchema = freightLayoutSchema(HBL_SECTION_KEYS);
const hawbLayoutSchema = freightLayoutSchema(HAWB_SECTION_KEYS);
const debitNoteLayoutSchema = freightLayoutSchema(DEBIT_NOTE_SECTION_KEYS);
const manifestLayoutSchema = freightLayoutSchema(MANIFEST_SECTION_KEYS);

export const documentTemplateLayoutSchemas = {
  QUOTATION: quotationLayoutSchema,
  INVOICE: invoiceLayoutSchema,
  HBL: hblLayoutSchema,
  HAWB: hawbLayoutSchema,
  DEBIT_NOTE: debitNoteLayoutSchema,
  MANIFEST: manifestLayoutSchema,
} as const;
