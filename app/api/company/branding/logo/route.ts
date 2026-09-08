import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { blobGet } from "@/lib/blob/client";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY" || !user.companyId)
    return new NextResponse("Not found", { status: 404 });

  const company = await prisma.company.findFirst({
    where: { id: user.companyId, deletedAt: null },
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
