import "server-only";
import Papa from "papaparse";

export type ImportEntityType = "CUSTOMER" | "VENDOR";

export const IMPORT_TARGET_FIELDS: Record<ImportEntityType, { field: string; label: string; required: boolean }[]> = {
  CUSTOMER: [
    { field: "name", label: "Name", required: true },
    { field: "code", label: "Code", required: false },
    { field: "email", label: "Email", required: false },
    { field: "phone", label: "Phone", required: false },
    { field: "address", label: "Address", required: false },
    { field: "binOrVat", label: "BIN/VAT", required: false },
    { field: "status", label: "Status (ACTIVE/INACTIVE)", required: false },
  ],
  VENDOR: [
    { field: "name", label: "Name", required: true },
    { field: "type", label: "Type", required: true },
    { field: "email", label: "Email", required: false },
    { field: "phone", label: "Phone", required: false },
    { field: "address", label: "Address", required: false },
    { field: "paymentTerms", label: "Payment Terms", required: false },
    { field: "notes", label: "Notes", required: false },
    { field: "status", label: "Status (ACTIVE/INACTIVE)", required: false },
  ],
};

export function parseImportCsv(buffer: Buffer) {
  const text = buffer.toString("utf-8").replace(/^﻿/, "");
  const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data };
}
