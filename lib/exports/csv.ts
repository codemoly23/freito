import "server-only";
import Papa from "papaparse";

export type CsvColumn<Row> = {
  header: string;
  accessor: (row: Row) => string | number | boolean | null | undefined;
};

// Prevents CSV formula injection: a cell that starts with =, +, -, or @ can be
// interpreted as a formula by Excel/Sheets when the file is opened. Prefixing
// with a straight quote keeps the value literal without changing what a human
// reader sees.
const FORMULA_PREFIXES = ["=", "+", "-", "@"];

export function toSafeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    return `'${text}`;
  }
  return text;
}

export function generateCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const data = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column.header, toSafeCsvCell(column.accessor(row))])),
  );
  return Papa.unparse(data, { columns: columns.map((column) => column.header) });
}
