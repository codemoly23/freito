import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/lib/permissions/rbac";
import { findSampleFreightDocumentForType, getDocumentTemplateWithCurrentVersion } from "@/lib/document-templates/queries";
import { SECTION_KEYS_BY_TYPE, SECTION_LABELS } from "@/lib/document-templates/sections";
import { TemplateEditor } from "@/components/document-templates/template-editor";

type PageProps = { params: Promise<{ id: string }> };

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  QUOTATION: "Quotation",
  INVOICE: "Invoice",
  HBL: "House Bill of Lading (HBL)",
  HAWB: "House Air Waybill (HAWB)",
  DEBIT_NOTE: "Debit note",
  MANIFEST: "Manifest",
};

const PDFKIT_PREVIEW_TYPES = new Set(["QUOTATION", "INVOICE"]);

export default async function DocumentTemplateEditorPage({ params }: PageProps) {
  const user = await requirePermission("documentTemplates:manage");
  const companyId = user.companyId ?? "";
  const { id } = await params;
  const template = await getDocumentTemplateWithCurrentVersion(companyId, id);
  if (!template) notFound();

  const defaultOrder = [...SECTION_KEYS_BY_TYPE[template.documentType]];
  const initialOrder = template.layout?.sections.order.length ? template.layout.sections.order : defaultOrder;
  const initialHidden = template.layout?.sections.hidden ?? [];
  const initialCustomNoteText = template.layout?.customNoteText ?? "";
  const usesPdfKitPreview = PDFKIT_PREVIEW_TYPES.has(template.documentType);
  const sample = usesPdfKitPreview
    ? null
    : await findSampleFreightDocumentForType(companyId, template.documentType as "HBL" | "HAWB" | "DEBIT_NOTE" | "MANIFEST");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Link href="/dashboard/settings/document-templates" className="text-sm text-cyan-600 hover:underline">
          ← Back to templates
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">
          {template.name} {template.isActive ? <Badge variant="success">Active</Badge> : null}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {DOCUMENT_TYPE_LABELS[template.documentType] ?? template.documentType} template. Version{" "}
          {template.currentVersion?.versionNumber ?? 1}.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Layout</CardTitle>
          <CardDescription>Saving creates a new version. Documents already generated with an earlier version keep their original layout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TemplateEditor
            templateId={template.id}
            sectionLabels={SECTION_LABELS[template.documentType]}
            initialOrder={initialOrder}
            initialHidden={initialHidden}
            initialCustomNoteText={initialCustomNoteText}
            showCustomNoteText={usesPdfKitPreview}
          />
          {usesPdfKitPreview ? (
            <Button asChild variant="outline" size="sm">
              <a href={`/api/document-templates/${template.id}/preview`} target="_blank" rel="noreferrer">
                Preview PDF (saved version)
              </a>
            </Button>
          ) : sample ? (
            <Button asChild variant="outline" size="sm">
              <a
                href={`/dashboard/shipments/${sample.shipmentJobId}/freight-documents/${sample.id}/print?previewTemplateId=${template.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Preview (saved version)
              </a>
            </Button>
          ) : (
            <p className="text-xs text-slate-400">
              No {DOCUMENT_TYPE_LABELS[template.documentType]?.split(" ")[0]} document exists yet to preview this
              layout with.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
