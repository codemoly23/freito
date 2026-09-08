import path from "node:path";

export const maxDocumentFileSize = 10 * 1024 * 1024;

export const allowedDocumentTypes = new Map([
  ["application/pdf", ".pdf"],
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["application/msword", ".doc"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".docx",
  ],
  ["application/vnd.ms-excel", ".xls"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xlsx",
  ],
]);

export const allowedExtensions = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
]);

export function sanitizeFileName(fileName: string) {
  const parsed = path.parse(fileName);
  const safeBase = parsed.name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const extension = parsed.ext.toLowerCase();

  return `${safeBase || "document"}${extension}`;
}

export function validateDocumentFile(file: File) {
  const originalName = sanitizeFileName(file.name);
  const extension = path.extname(originalName).toLowerCase();

  if (!file.size) return "Select a file to upload.";
  if (file.size > maxDocumentFileSize) return "File must be 10MB or smaller.";
  if (!allowedExtensions.has(extension)) return "Unsupported file extension.";
  if (!file.type) return "File type is required.";
  if (!allowedDocumentTypes.has(file.type)) return "Unsupported file type.";

  return null;
}

export function storageRoot() {
  return path.join(process.cwd(), "storage", "uploads");
}
