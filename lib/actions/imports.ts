"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { blobDelete, blobGet, blobPut } from "@/lib/blob/client";
import { sanitizeFileName } from "@/lib/documents/storage";
import { customerSchema, vendorSchema } from "@/lib/validators/admin";
import { IMPORT_TARGET_FIELDS, parseImportCsv, type ImportEntityType } from "@/lib/imports/csv";
import {
  type ActionState,
  audit,
  getFormData,
  getScopedCompanyId,
  getString,
  successState,
  validationError,
} from "@/lib/actions/helpers";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;
const MAX_STORED_ROW_ERRORS = 200;
const COMMIT_BATCH_SIZE = 100;

type EntityType = ImportEntityType;

const TARGET_FIELDS: Record<EntityType, string[]> = {
  CUSTOMER: IMPORT_TARGET_FIELDS.CUSTOMER.map((f) => f.field),
  VENDOR: IMPORT_TARGET_FIELDS.VENDOR.map((f) => f.field),
};
const parseCsv = parseImportCsv;

function permissionForEntity(entityType: EntityType) {
  return entityType === "CUSTOMER" ? "customers:manage" : "vendors:manage";
}

function parseEntityType(value: string): EntityType | null {
  return value === "CUSTOMER" || value === "VENDOR" ? value : null;
}

async function requireImportPermission(entityType: EntityType) {
  const scoped = await getScopedCompanyId(permissionForEntity(entityType));
  if (!scoped.user.permissions?.includes("imports:csv")) {
    redirect("/dashboard?access=denied");
  }
  return scoped;
}

function cellValue(row: Record<string, string>, mapping: Record<string, string>, field: string) {
  const sourceHeader = mapping[field];
  if (!sourceHeader) return "";
  return (row[sourceHeader] ?? "").trim();
}

function validateRow(entityType: EntityType, row: Record<string, string>, mapping: Record<string, string>) {
  const fields = TARGET_FIELDS[entityType];
  const input: Record<string, string> = {};
  for (const field of fields) {
    input[field] = cellValue(row, mapping, field);
  }
  if (!input.status) input.status = "ACTIVE";
  // customerSchema also covers primary-contact fields that have no column in
  // the CSV mapping UI at all -- an entirely missing key fails `email`-shaped
  // Zod chains (they require a string, not `undefined`), so backfill it as
  // "not provided" the same way a blank manual-form field would submit.
  if (entityType === "CUSTOMER") input.contactEmail = "";
  const schema = entityType === "CUSTOMER" ? customerSchema : vendorSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues.map((issue) => issue.message).join("; "), input };
  }
  return { ok: true as const, data: parsed.data, input };
}

// Phase 05 v1: vendor has no unique business key (unlike customer's
// companyId+code), so duplicate detection falls back to an exact, trimmed
// name match. This is a real limitation -- two vendors could legitimately
// share a display name -- documented, not hidden.
async function findExistingKeys(companyId: string, entityType: EntityType, values: string[]) {
  const unique = [...new Set(values.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  if (entityType === "CUSTOMER") {
    const rows = await prisma.customer.findMany({
      where: { companyId, deletedAt: null, code: { in: unique } },
      select: { id: true, code: true },
    });
    return new Map(rows.filter((r) => r.code).map((r) => [r.code as string, r.id]));
  }
  const rows = await prisma.vendor.findMany({
    where: { companyId, deletedAt: null, name: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.name.trim().toLowerCase(), r.id]));
}

function duplicateKeyFor(entityType: EntityType, data: { name: string; code?: string | null }) {
  return entityType === "CUSTOMER" ? data.code ?? null : data.name.trim().toLowerCase();
}

type RowOutcome = { row: number; outcome: "valid" | "duplicate" | "invalid"; message?: string };

async function evaluateFile(
  companyId: string,
  entityType: EntityType,
  buffer: Buffer,
  columnMapping: Record<string, string>,
  duplicatePolicy: "REJECT" | "SKIP" | "UPDATE",
) {
  const { rows } = parseCsv(buffer);
  const capped = rows.slice(0, MAX_IMPORT_ROWS);
  const validated = capped.map((row, index) => ({ index, result: validateRow(entityType, row, columnMapping) }));
  const candidateKeys = validated
    .filter((v) => v.result.ok)
    .map((v) => duplicateKeyFor(entityType, v.result.data as { name: string; code?: string | null }))
    .filter((key): key is string => Boolean(key));
  const existingKeys = await findExistingKeys(companyId, entityType, candidateKeys);
  const seenInFile = new Set<string>();

  const outcomes: RowOutcome[] = [];
  const toCreate: { data: Record<string, unknown>; rowIndex: number }[] = [];
  const toUpdate: { id: string; data: Record<string, unknown>; rowIndex: number }[] = [];

  for (const { index, result } of validated) {
    const rowNumber = index + 2; // header row is line 1
    if (!result.ok) {
      outcomes.push({ row: rowNumber, outcome: "invalid", message: result.message });
      continue;
    }
    const key = duplicateKeyFor(entityType, result.data as { name: string; code?: string | null });
    const existingId = key ? existingKeys.get(key) : undefined;
    const duplicateInFile = key ? seenInFile.has(key) : false;
    if (key) seenInFile.add(key);

    if (existingId || duplicateInFile) {
      if (duplicatePolicy === "REJECT") {
        outcomes.push({ row: rowNumber, outcome: "duplicate", message: `Duplicate ${entityType === "CUSTOMER" ? "code" : "name"}: ${key}` });
        continue;
      }
      if (duplicatePolicy === "SKIP" || duplicateInFile) {
        outcomes.push({ row: rowNumber, outcome: "duplicate", message: duplicateInFile ? "Duplicate within file" : "Already exists, skipped" });
        continue;
      }
      // UPDATE, and this is the first occurrence of this key in the file
      toUpdate.push({ id: existingId!, data: result.data, rowIndex: rowNumber });
      outcomes.push({ row: rowNumber, outcome: "valid" });
      continue;
    }
    toCreate.push({ data: result.data, rowIndex: rowNumber });
    outcomes.push({ row: rowNumber, outcome: "valid" });
  }

  return { totalRows: capped.length, outcomes, toCreate, toUpdate };
}

export async function uploadImportFile(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const entityType = parseEntityType(getString(formData, "entityType"));
  if (!entityType) return validationError("Select customers or vendors to import.");
  const { user, companyId } = await requireImportPermission(entityType);

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return validationError("Select a CSV file to upload.");
  if (file.size > MAX_IMPORT_FILE_SIZE) return validationError("File must be 5MB or smaller.");
  const safeName = sanitizeFileName(file.name);
  if (!safeName.toLowerCase().endsWith(".csv")) return validationError("Only .csv files are supported.");
  if (file.type && !["text/csv", "application/vnd.ms-excel", "text/plain"].includes(file.type)) {
    return validationError("Unsupported file type. Upload a CSV file.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { headers, rows } = parseCsv(buffer);
  if (!headers.length) return validationError("The file has no header row.");
  if (rows.length > MAX_IMPORT_ROWS) return validationError(`File has too many rows (max ${MAX_IMPORT_ROWS}).`);
  if (!rows.length) return validationError("The file has no data rows.");

  const importJobId = randomUUID();
  const filePath = `imports/${companyId}/${importJobId}/${safeName}`;
  await blobPut(filePath, buffer, "text/csv");

  await prisma.importjob.create({
    data: {
      id: importJobId,
      companyId,
      actorId: user.id,
      entityType,
      status: "UPLOADED",
      fileName: safeName,
      filePath,
      fileSize: file.size,
      rowCount: rows.length,
      updatedAt: new Date(),
    },
  });

  await audit({ companyId, actorId: user.id, action: "IMPORT_FILE_UPLOADED", entityType, entityId: importJobId, metadata: { fileName: safeName, rowCount: rows.length } });
  revalidatePath("/dashboard/imports");
  redirect(`/dashboard/imports/${importJobId}`);
}

export async function previewImport(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const importJobId = getString(formData, "importJobId");
  const duplicatePolicyRaw = getString(formData, "duplicatePolicy");
  const duplicatePolicy = ["REJECT", "SKIP", "UPDATE"].includes(duplicatePolicyRaw) ? (duplicatePolicyRaw as "REJECT" | "SKIP" | "UPDATE") : "REJECT";

  const job = await prisma.importjob.findFirst({ where: { id: importJobId } });
  if (!job) return validationError("Import job was not found.");
  const { user, companyId } = await requireImportPermission(job.entityType as EntityType);
  if (job.companyId !== companyId) return validationError("Import job was not found.");
  if (job.status !== "UPLOADED" && job.status !== "VALIDATED") return validationError("This import job can no longer be edited.");

  const columnMapping: Record<string, string> = {};
  for (const field of TARGET_FIELDS[job.entityType as EntityType]) {
    const mapped = getString(formData, `map_${field}`);
    if (mapped) columnMapping[field] = mapped;
  }
  if (!columnMapping.name) return validationError("Map a source column to Name.");

  const buffer = await blobGet(job.filePath);
  if (!buffer) return validationError("The uploaded file is no longer available. Please upload again.");

  const evaluation = await evaluateFile(companyId, job.entityType as EntityType, buffer, columnMapping, duplicatePolicy);
  const rowErrors = evaluation.outcomes.filter((o) => o.outcome !== "valid").slice(0, MAX_STORED_ROW_ERRORS);

  await prisma.importjob.update({
    where: { id: job.id },
    data: {
      status: "VALIDATED",
      columnMapping: JSON.stringify(columnMapping),
      duplicatePolicy,
      rowCount: evaluation.totalRows,
      rowErrors: JSON.stringify(rowErrors),
      updatedAt: new Date(),
    },
  });

  await audit({ companyId, actorId: user.id, action: "IMPORT_PREVIEWED", entityType: job.entityType, entityId: job.id, metadata: { valid: evaluation.toCreate.length + evaluation.toUpdate.length, rejected: rowErrors.length } });
  revalidatePath(`/dashboard/imports/${job.id}`);
  return successState("Preview generated.");
}

export async function commitImport(
  stateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = getFormData(stateOrFormData, maybeFormData);
  const importJobId = getString(formData, "importJobId");

  const job = await prisma.importjob.findFirst({ where: { id: importJobId } });
  if (!job) return validationError("Import job was not found.");
  const { user, companyId } = await requireImportPermission(job.entityType as EntityType);
  if (job.companyId !== companyId) return validationError("Import job was not found.");
  if (job.status !== "VALIDATED") return validationError("Preview the import before committing.");
  if (!job.columnMapping || !job.duplicatePolicy) return validationError("Column mapping is missing. Re-run preview.");

  await prisma.importjob.update({ where: { id: job.id }, data: { status: "COMMITTING", updatedAt: new Date() } });

  const buffer = await blobGet(job.filePath);
  if (!buffer) {
    await prisma.importjob.update({ where: { id: job.id }, data: { status: "FAILED", errorMessage: "Source file no longer available.", updatedAt: new Date() } });
    return validationError("The uploaded file is no longer available.");
  }

  const columnMapping = JSON.parse(job.columnMapping) as Record<string, string>;
  const entityType = job.entityType as EntityType;
  // Re-validate at commit time -- never trust the preview snapshot, the
  // underlying data (existing codes/names) may have changed since preview.
  const evaluation = await evaluateFile(companyId, entityType, buffer, columnMapping, job.duplicatePolicy as "REJECT" | "SKIP" | "UPDATE");

  let createdCount = 0;
  let updatedCount = 0;
  const commitErrors: RowOutcome[] = [];

  for (let i = 0; i < evaluation.toCreate.length; i += COMMIT_BATCH_SIZE) {
    const batch = evaluation.toCreate.slice(i, i + COMMIT_BATCH_SIZE);
    for (const item of batch) {
      try {
        if (entityType === "CUSTOMER") {
          const data = item.data as { name: string; code?: string | null; email?: string | null; phone?: string | null; address?: string | null; binOrVat?: string | null; status: string };
          await prisma.customer.create({
            data: { id: randomUUID(), companyId, name: data.name, code: data.code ?? null, email: data.email ?? null, phone: data.phone ?? null, address: data.address ?? null, binOrVat: data.binOrVat ?? null, status: data.status as never, updatedAt: new Date() },
          });
        } else {
          const data = item.data as { name: string; type: string; email?: string | null; phone?: string | null; address?: string | null; paymentTerms?: string | null; notes?: string | null; status: string };
          await prisma.vendor.create({
            data: { id: randomUUID(), companyId, name: data.name, type: data.type as never, email: data.email ?? null, phone: data.phone ?? null, address: data.address ?? null, paymentTerms: data.paymentTerms ?? null, notes: data.notes ?? null, status: data.status as never, updatedAt: new Date() },
          });
        }
        createdCount += 1;
      } catch (error) {
        const message = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? "Duplicate key" : "Could not create row";
        commitErrors.push({ row: item.rowIndex, outcome: "duplicate", message });
      }
    }
  }

  for (const item of evaluation.toUpdate) {
    try {
      if (entityType === "CUSTOMER") {
        const data = item.data as { name: string; code?: string | null; email?: string | null; phone?: string | null; address?: string | null; binOrVat?: string | null; status: string };
        await prisma.customer.update({
          where: { id: item.id },
          data: { name: data.name, email: data.email ?? null, phone: data.phone ?? null, address: data.address ?? null, binOrVat: data.binOrVat ?? null, status: data.status as never, updatedAt: new Date() },
        });
      } else {
        const data = item.data as { name: string; type: string; email?: string | null; phone?: string | null; address?: string | null; paymentTerms?: string | null; notes?: string | null; status: string };
        await prisma.vendor.update({
          where: { id: item.id },
          data: { type: data.type as never, email: data.email ?? null, phone: data.phone ?? null, address: data.address ?? null, paymentTerms: data.paymentTerms ?? null, notes: data.notes ?? null, status: data.status as never, updatedAt: new Date() },
        });
      }
      updatedCount += 1;
    } catch {
      commitErrors.push({ row: item.rowIndex, outcome: "invalid", message: "Could not update row" });
    }
  }

  const skippedOrRejected = evaluation.outcomes.filter((o) => o.outcome !== "valid");
  const allErrors = [...skippedOrRejected, ...commitErrors].slice(0, MAX_STORED_ROW_ERRORS);
  const rejectedCount = evaluation.outcomes.filter((o) => o.outcome === "invalid" || (o.outcome === "duplicate" && job.duplicatePolicy === "REJECT")).length + commitErrors.length;
  const skippedCount = evaluation.outcomes.filter((o) => o.outcome === "duplicate" && job.duplicatePolicy !== "REJECT").length;

  await prisma.importjob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      createdCount,
      skippedCount: skippedCount + updatedCount,
      rejectedCount,
      rowErrors: JSON.stringify(allErrors),
      completedAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await audit({ companyId, actorId: user.id, action: "IMPORT_COMMITTED", entityType, entityId: job.id, metadata: { created: createdCount, updated: updatedCount, skipped: skippedCount, rejected: rejectedCount } });
  revalidatePath(`/dashboard/imports/${job.id}`);
  revalidatePath(entityType === "CUSTOMER" ? "/dashboard/customers" : "/dashboard/vendors");
  return successState("Import completed.");
}

export async function cancelImport(formData: FormData) {
  const importJobId = getString(formData, "importJobId");
  const job = await prisma.importjob.findFirst({ where: { id: importJobId } });
  if (!job) return;
  const { companyId } = await requireImportPermission(job.entityType as EntityType);
  if (job.companyId !== companyId) return;
  await prisma.importjob.update({ where: { id: job.id }, data: { status: "CANCELLED", updatedAt: new Date() } });
  await blobDelete(job.filePath);
  revalidatePath("/dashboard/imports");
  redirect("/dashboard/imports");
}
