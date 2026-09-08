import { prisma } from "@/lib/db/prisma";
import { dashboardLayoutSchema } from "@/lib/validators/dashboard-layout";
import { normalizeDashboardLayout, type DashboardLayout } from "@/lib/dashboard/widgets";

export async function getDashboardLayout(companyId: string, userId: string): Promise<DashboardLayout> {
  const row = await prisma.userdashboardlayout.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { layoutJson: true },
  });

  if (!row) return normalizeDashboardLayout(null);

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(row.layoutJson);
  } catch {
    parsed = null;
  }

  const validated = dashboardLayoutSchema.safeParse(parsed);
  return normalizeDashboardLayout(validated.success ? validated.data : null);
}
