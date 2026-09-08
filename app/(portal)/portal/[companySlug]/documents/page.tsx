import { PortalHeader } from "@/components/portal/portal-header";
import { PortalDocumentsClient } from "@/components/portal/portal-documents-client";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";

export default async function PortalDocumentsPage({
  params,
}: {
  params: Promise<{ companySlug: string }>;
}) {
  const { companySlug } = await params;
  const { account } = await requirePortalAccount(companySlug);

  const [company, shipments] = await Promise.all([
    prisma.company.findUnique({
      where: { id: account.companyId },
      select: { logoPath: true },
    }),
    prisma.shipmentjob.findMany({
      where: {
        companyId: account.companyId,
        customerId: account.customerId,
        deletedAt: null,
        shipmentrequest: {
          clientPortalAccountId: account.id,
          deletedAt: null,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobNo: true,
        shipmentType: true,
        transportMode: true,
        originCountry: true,
        destinationCountry: true,
        currentStatus: true,
        freightdocument: {
          where: {
            companyId: account.companyId,
            isClientVisible: true,
            visibility: "CLIENT_SAFE",
            deletedAt: null,
            type: {
              in: [
                "HBL",
                "HAWB",
                "MANIFEST",
                "DEBIT_NOTE",
                "COMMERCIAL_INVOICE",
                "PACKING_LIST",
                "CERTIFICATE_OF_ORIGIN",
                "MSDS_DG_CERTIFICATE",
                "INSURANCE_CERTIFICATE",
                "POD",
                "DELIVERY_CHALLAN",
                "DELIVERY_ORDER",
                "CUSTOMS_RELEASE",
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            documentNo: true,
            type: true,
            status: true,
            createdAt: true,
            filePath: true,
          },
        },
      },
    }),
  ]);

  const shipmentsFormatted = shipments.map((s) => ({
    ...s,
    freightDocuments: s.freightdocument,
  }));

  return (
    <main className="min-h-screen bg-slate-50">
      <PortalHeader
        companySlug={companySlug}
        companyName={account.company.portalDisplayName ?? account.company.name}
        customerName={account.customer.name}
        clientCode={account.displayClientCode}
        hasLogo={Boolean(company?.logoPath)}
        mustChangePassword={account.mustChangePassword}
      />
      <section className="mx-auto max-w-6xl space-y-6 p-5">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Documents</h2>
          <p className="text-sm text-slate-600">
            View all client-visible freight and operational documents organized by Shipment Job ID folders.
          </p>
        </div>

        <PortalDocumentsClient
          shipments={shipmentsFormatted}
          companySlug={companySlug}
        />
      </section>
    </main>
  );
}
