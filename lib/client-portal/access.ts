import "server-only";
import { redirect } from "next/navigation";
import { requireActiveCompanyAccess, requireModuleAccess } from "@/lib/access/company-access";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function requirePortalAccount(companySlug: string) {
  const user = await getCurrentUser();
  if (
    !user ||
    user.scope !== "CLIENT" ||
    !user.companyId ||
    !user.customerId ||
    !user.clientPortalAccountId ||
    user.companySlug !== companySlug
  ) {
    redirect(`/portal/${companySlug}/login`);
  }
  await requireActiveCompanyAccess(user.companyId);
  await requireModuleAccess(user.companyId, "CLIENT_PORTAL");
  const account = await prisma.clientportalaccount.findFirst({
    where: {
      id: user.clientPortalAccountId,
      companyId: user.companyId,
      customerId: user.customerId,
      status: { in: ["ACTIVE", "INVITED"] },
      deletedAt: null,
      company: { portalSlug: companySlug, portalEnabled: true },
    },
    select: {
      id: true,
      companyId: true,
      customerId: true,
      displayClientCode: true,
      mustChangePassword: true,
      customer: { select: { name: true } },
      company: { select: { name: true, portalDisplayName: true } },
    },
  });
  if (!account) redirect(`/portal/${companySlug}/login`);
  return { user, account };
}
