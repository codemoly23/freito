import { notFound } from "next/navigation";
import { blobGet } from "@/lib/blob/client";
import { cancelImport, commitImport, previewImport } from "@/lib/actions/imports";
import { IMPORT_TARGET_FIELDS, parseImportCsv, type ImportEntityType } from "@/lib/imports/csv";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { ImportCommitForm, ImportMappingForm } from "@/components/forms/import-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type RowOutcome = { row: number; outcome: "valid" | "duplicate" | "invalid"; message?: string };

export default async function ImportJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("imports:csv");
  const companyId = user.companyId ?? "";

  const job = await prisma.importjob.findFirst({ where: { id, companyId } });
  if (!job) notFound();

  const entityType = job.entityType as ImportEntityType;
  const fields = IMPORT_TARGET_FIELDS[entityType];
  const rowErrors: RowOutcome[] = job.rowErrors ? JSON.parse(job.rowErrors) : [];

  let headers: string[] = [];
  if (job.status === "UPLOADED" || job.status === "VALIDATED") {
    const buffer = await blobGet(job.filePath);
    if (buffer) headers = parseImportCsv(buffer).headers;
  }

  const savedMapping: Record<string, string> = job.columnMapping ? JSON.parse(job.columnMapping) : {};

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 05</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">{job.fileName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {entityType === "CUSTOMER" ? "Customer" : "Vendor"} import &middot; {job.rowCount ?? 0} rows &middot; <Badge variant="secondary">{job.status}</Badge>
        </p>
      </div>

      {job.status === "UPLOADED" && headers.length ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Step 2: Map columns</CardTitle>
            <CardDescription>Match each target field to a column from your file. Preview writes nothing yet.</CardDescription>
          </CardHeader>
          <CardContent>
            <ImportMappingForm
              action={previewImport}
              importJobId={job.id}
              headers={headers}
              fields={fields}
              defaultMapping={savedMapping}
              defaultDuplicatePolicy={(job.duplicatePolicy as "REJECT" | "SKIP" | "UPDATE" | null) ?? "REJECT"}
            />
          </CardContent>
        </Card>
      ) : null}

      {job.status === "UPLOADED" && !headers.length ? (
        <Card className="max-w-xl">
          <CardContent className="p-6 text-sm text-red-600">
            The uploaded file could not be read. It may have expired from storage -- start a new import.
          </CardContent>
        </Card>
      ) : null}

      {job.status === "VALIDATED" ? (
        <>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Step 3: Preview</CardTitle>
              <CardDescription>Nothing has been created yet. Review the summary, then commit.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-2xl font-semibold text-slate-950">{job.rowCount ?? 0}</p>
                  <p className="text-xs text-slate-500">Total rows</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-2xl font-semibold text-emerald-600">{(job.rowCount ?? 0) - rowErrors.length}</p>
                  <p className="text-xs text-slate-500">Would create/update</p>
                </div>
                <div className="rounded-md border border-slate-200 p-3">
                  <p className="text-2xl font-semibold text-amber-600">{rowErrors.length}</p>
                  <p className="text-xs text-slate-500">Skipped / rejected</p>
                </div>
              </div>
              <ImportCommitForm action={commitImport} importJobId={job.id} />
            </CardContent>
          </Card>

          {headers.length ? (
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Change mapping</CardTitle>
                <CardDescription>Adjust the column mapping or duplicate policy and re-preview.</CardDescription>
              </CardHeader>
              <CardContent>
                <ImportMappingForm
              action={previewImport}
              importJobId={job.id}
              headers={headers}
              fields={fields}
              defaultMapping={savedMapping}
              defaultDuplicatePolicy={(job.duplicatePolicy as "REJECT" | "SKIP" | "UPDATE" | null) ?? "REJECT"}
            />
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}

      {rowErrors.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Row issues</CardTitle>
            <CardDescription>Showing up to {rowErrors.length} rows that were skipped or rejected.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-auto rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Row</th>
                    <th className="px-4 py-2">Outcome</th>
                    <th className="px-4 py-2">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {rowErrors.map((e, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{e.row}</td>
                      <td className="px-4 py-2">{e.outcome}</td>
                      <td className="px-4 py-2 text-slate-600">{e.message ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {job.status === "COMPLETED" ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Import completed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>{job.createdCount}</strong> created</p>
            <p><strong>{job.skippedCount}</strong> skipped/updated</p>
            <p><strong>{job.rejectedCount}</strong> rejected</p>
          </CardContent>
        </Card>
      ) : null}

      {job.status === "FAILED" ? (
        <Card className="max-w-xl">
          <CardContent className="p-6 text-sm text-red-600">{job.errorMessage ?? "The import failed."}</CardContent>
        </Card>
      ) : null}

      {job.status === "UPLOADED" || job.status === "VALIDATED" ? (
        <form action={cancelImport}>
          <input type="hidden" name="importJobId" value={job.id} />
          <Button type="submit" variant="outline">Cancel import</Button>
        </form>
      ) : null}
    </main>
  );
}
