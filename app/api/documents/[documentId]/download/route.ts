import { NextResponse } from "next/server";
import { hasModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import { getCurrentUser } from "@/lib/auth/session";
import { blobGet } from "@/lib/blob/client";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY" || !hasPermission(user, "documents:download")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { documentId } = await params;
  const branchWhere = branchScopeWhere(await getAccessibleBranchIds({ userId: user.id, companyId: user.companyId ?? "", permissions: user.permissions ?? [] }));
  const document = await prisma.shipmentdocument.findFirst({
    where: {
      id: documentId,
      deletedAt: null,
      companyId: user.companyId ?? "",
      ...branchWhere,
    },
  });

  if (!document?.filePath || !document.fileName) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!(await hasModuleAccess(document.companyId, "DOCUMENTS"))) {
    return new NextResponse("Not found", { status: 404 });
  }

  const file = await blobGet(document.filePath);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": document.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        document.originalFileName ?? document.fileName,
      )}"`,
      "Content-Length": String(file.byteLength),
    },
  });
}
