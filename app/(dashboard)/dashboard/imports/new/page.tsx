import { uploadImportFile } from "@/lib/actions/imports";
import { requirePermission } from "@/lib/permissions/rbac";
import { ImportUploadForm } from "@/components/forms/import-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewImportPage() {
  await requirePermission("imports:csv");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Step 1 of 3</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Upload CSV file</h1>
        <p className="mt-1 text-sm text-slate-600">
          Import customer or vendor records. Preview never writes to the database -- you confirm before anything is created.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Choose data and file</CardTitle>
          <CardDescription>CSV only, up to 5MB and 5,000 rows.</CardDescription>
        </CardHeader>
        <CardContent>
          <ImportUploadForm action={uploadImportFile} />
        </CardContent>
      </Card>
    </main>
  );
}
