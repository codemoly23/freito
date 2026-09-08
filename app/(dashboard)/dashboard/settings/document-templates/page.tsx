import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/permissions/rbac";
import { findSampleFreightDocumentForType, listDocumentTemplates } from "@/lib/document-templates/queries";
import {
  activateDocumentTemplate,
  deactivateDocumentTemplate,
  deleteDocumentTemplate,
  duplicateDocumentTemplate,
} from "@/lib/actions/document-templates";
import { CreateTemplateForm } from "@/components/document-templates/create-template-form";
import type { DocumentTemplateType } from "@/lib/validators/document-templates";

const DOCUMENT_TYPES: { key: DocumentTemplateType; label: string; pdfPreview: boolean }[] = [
  { key: "QUOTATION", label: "Quotation templates", pdfPreview: true },
  { key: "INVOICE", label: "Invoice templates", pdfPreview: true },
  { key: "HBL", label: "House Bill of Lading (HBL) templates", pdfPreview: false },
  { key: "HAWB", label: "House Air Waybill (HAWB) templates", pdfPreview: false },
  { key: "DEBIT_NOTE", label: "Debit note templates", pdfPreview: false },
  { key: "MANIFEST", label: "Manifest templates", pdfPreview: false },
];

export default async function DocumentTemplatesPage() {
  const user = await requirePermission("documentTemplates:manage");
  const companyId = user.companyId ?? "";
  const templates = await listDocumentTemplates(companyId);
  const freightSamples = Object.fromEntries(
    await Promise.all(
      (["HBL", "HAWB", "DEBIT_NOTE", "MANIFEST"] as const).map(async (type) => [
        type,
        await findSampleFreightDocumentForType(companyId, type),
      ]),
    ),
  ) as Record<"HBL" | "HAWB" | "DEBIT_NOTE" | "MANIFEST", { id: string; shipmentJobId: string } | null>;

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Document Templates</h1>
        <p className="mt-1 text-sm text-slate-600">
          Customize the section order and visibility of your quotation, invoice, and freight document (HBL/HAWB/debit
          note/manifest) print layouts. With no active custom template, the system default layout (identical to
          before this feature existed) is always used.
        </p>
      </div>

      {DOCUMENT_TYPES.map(({ key, label, pdfPreview }) => {
        const group = templates.filter((template) => template.documentType === key);
        const sample = pdfPreview ? null : freightSamples[key as "HBL" | "HAWB" | "DEBIT_NOTE" | "MANIFEST"];
        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardDescription>
                {group.some((template) => template.isActive)
                  ? "A custom template is active for this document type."
                  : "No custom template is active -- the system default layout is used."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CreateTemplateForm documentType={key} placeholder={`e.g. Custom ${label.split(" ")[0]}`} />

              <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {group.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No templates yet.</p>
                ) : (
                  group.map((template) => (
                    <div key={template.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <div>
                        <p className="font-medium text-slate-950">
                          {template.name}{" "}
                          {template.isActive ? <Badge variant="success">Active</Badge> : null}
                        </p>
                        <p className="text-xs text-slate-500">Updated {template.updatedAt.toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/settings/document-templates/${template.id}`}>Edit</Link>
                        </Button>
                        {pdfPreview ? (
                          <Button asChild size="sm" variant="outline">
                            <a href={`/api/document-templates/${template.id}/preview`} target="_blank" rel="noreferrer">
                              Preview PDF
                            </a>
                          </Button>
                        ) : sample ? (
                          <Button asChild size="sm" variant="outline">
                            <a
                              href={`/dashboard/shipments/${sample.shipmentJobId}/freight-documents/${sample.id}/print?previewTemplateId=${template.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Preview
                            </a>
                          </Button>
                        ) : (
                          <span className="self-center text-xs text-slate-400">
                            No {label.split(" ")[0]} document yet to preview with
                          </span>
                        )}
                        {template.isActive ? (
                          <form action={deactivateDocumentTemplate}>
                            <input type="hidden" name="id" value={template.id} />
                            <Button type="submit" size="sm" variant="outline">Deactivate</Button>
                          </form>
                        ) : (
                          <form action={activateDocumentTemplate}>
                            <input type="hidden" name="id" value={template.id} />
                            <Button type="submit" size="sm" variant="outline">Activate</Button>
                          </form>
                        )}
                        <form action={duplicateDocumentTemplate}>
                          <input type="hidden" name="id" value={template.id} />
                          <Button type="submit" size="sm" variant="outline">Duplicate</Button>
                        </form>
                        <form action={deleteDocumentTemplate}>
                          <input type="hidden" name="id" value={template.id} />
                          <Button type="submit" size="sm" variant="destructive">Delete</Button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
