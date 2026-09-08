import { redirect } from "next/navigation";
import { hasModuleAccess, requireActiveCompanyAccess } from "@/lib/access/company-access";
import { requireUserScope } from "@/lib/permissions/rbac";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUserScope("CLIENT");
  await requireActiveCompanyAccess(user.companyId);
  if (!(await hasModuleAccess(user.companyId, "CLIENT_PORTAL"))) {
    redirect(user.companySlug ? `/portal/${user.companySlug}/login` : "/portal-login");
  }
  return children;
}
