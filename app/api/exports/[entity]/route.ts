import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccessibleBranchIds } from "@/lib/access/branch-access";
import { ensureActiveCompanyAccess } from "@/lib/access/company-access";
import { audit } from "@/lib/actions/helpers";
import { generateCsv } from "@/lib/exports/csv";
import { exportEntities } from "@/lib/exports/export-entities";
import { hasPermission } from "@/lib/permissions/rbac";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;
  // Allowlisted entity keys only -- an unrecognized value is a 404, never a
  // raw table/query lookup driven by the URL.
  const config = exportEntities[entity];
  if (!config) return new NextResponse("Not found", { status: 404 });

  const user = await getCurrentUser();
  if (!user || user.scope !== "COMPANY" || !user.companyId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (await ensureActiveCompanyAccess(user.companyId)) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (!hasPermission(user, config.permission) || !hasPermission(user, "exports:csv")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const companyId = user.companyId;
  const accessibleBranchIds = config.branchScoped
    ? await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] })
    : null;

  const ctx = { companyId, user, accessibleBranchIds };
  const rows = await config.fetch(ctx);
  const csv = generateCsv(rows, config.columns(ctx));

  await audit({
    companyId,
    actorId: user.id,
    action: "EXPORT_CSV",
    entityType: config.label,
    metadata: { entity: config.key, rowCount: rows.length },
  });

  const fileName = `${config.key}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
