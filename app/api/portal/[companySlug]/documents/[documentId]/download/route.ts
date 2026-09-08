import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCompanyAccessStatus, hasModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { blobGet } from "@/lib/blob/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companySlug: string; documentId: string }> },
) {
  const { companySlug, documentId } = await params;

  const user = await getCurrentUser();
  if (
    !user ||
    user.scope !== "CLIENT" ||
    !user.companyId ||
    !user.customerId ||
    !user.clientPortalAccountId ||
    user.companySlug !== companySlug
  ) {
    return new NextResponse("Not found", { status: 404 });
  }

  const companyAccess = await getCompanyAccessStatus(user.companyId);
  if (!companyAccess.allowed) return new NextResponse("Not found", { status: 404 });

  const moduleAccess = await hasModuleAccess(user.companyId, "CLIENT_PORTAL");
  if (!moduleAccess) return new NextResponse("Not found", { status: 404 });

  const account = await prisma.clientportalaccount.findFirst({
    where: {
      id: user.clientPortalAccountId,
      companyId: user.companyId,
      customerId: user.customerId,
      status: "ACTIVE",
      deletedAt: null,
      company: { portalSlug: companySlug, portalEnabled: true },
    },
  });
  if (!account) return new NextResponse("Not found", { status: 404 });

  const freightDoc = await prisma.freightdocument.findFirst({
    where: {
      id: documentId,
      companyId: account.companyId,
      isClientVisible: true,
      visibility: "CLIENT_SAFE",
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
      deletedAt: null,
      shipmentjob: {
        customerId: account.customerId,
        deletedAt: null,
        shipmentrequest: { clientPortalAccountId: account.id, deletedAt: null },
      },
    },
    select: {
      filePath: true,
      fileName: true,
      originalFileName: true,
      mimeType: true,
    },
  });

  if (!freightDoc?.filePath || !freightDoc.fileName) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await blobGet(freightDoc.filePath);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": freightDoc.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        freightDoc.originalFileName ?? freightDoc.fileName,
      )}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
