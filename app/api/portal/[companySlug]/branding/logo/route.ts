import { NextResponse } from "next/server";
import { brandingStorageRoot } from "@/lib/branding/storage";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";
import { blobGet } from "@/lib/blob/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companySlug: string }> },
) {
  const { companySlug } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const company = await prisma.company.findFirst({
    where: { id: account.companyId, portalSlug: companySlug, deletedAt: null },
    select: { logoPath: true, logoMimeType: true },
  });
  if (!company?.logoPath) return new NextResponse("Not found", { status: 404 });

  const file = await blobGet(company.logoPath);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": company.logoMimeType ?? "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
