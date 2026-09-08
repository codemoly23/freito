import { BrandingForm } from "@/components/forms/branding-form";
import { HblPrintSettingsForm } from "@/components/forms/hbl-print-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadCompanyLogo, saveHblPrintSettings } from "@/lib/actions/branding";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";

export default async function BrandingSettingsPage() {
  const user = await requirePermission("branding:manage");
  const company = await prisma.company.findFirst({
    where: { id: user.companyId ?? "", deletedAt: null },
    select: {
      name: true,
      legalName: true,
      logoPath: true,
      logoUpdatedAt: true,
      hblOriginalsLimit: true,
      hblOfficeLimit: true,
      hblAccountsLimit: true,
      hblOperationsLimit: true,
      hblCustomerLimit: true,
      hblArchiveLimit: true,
      hblPrintWatermarkEnabled: true,
    },
  });
  if (!company) return null;
  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Company Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage tenant identity, logo, and document printing copy limits.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Company Branding</CardTitle>
          <CardDescription>
            Logo files remain private and are served only through authenticated routes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingForm
            action={uploadCompanyLogo}
            hasLogo={Boolean(company.logoPath)}
            logoVersion={company.logoUpdatedAt?.getTime().toString()}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>HBL Print & Copy Settings</CardTitle>
          <CardDescription>
            Configure the default number of originals and operational copies generated for HBL documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HblPrintSettingsForm
            action={saveHblPrintSettings}
            initialValues={{
              hblOriginalsLimit: company.hblOriginalsLimit,
              hblOfficeLimit: company.hblOfficeLimit,
              hblAccountsLimit: company.hblAccountsLimit,
              hblOperationsLimit: company.hblOperationsLimit,
              hblCustomerLimit: company.hblCustomerLimit,
              hblArchiveLimit: company.hblArchiveLimit,
              hblPrintWatermarkEnabled: company.hblPrintWatermarkEnabled,
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
