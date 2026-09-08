import { redirect } from "next/navigation";
import { requireUserScope } from "@/lib/permissions/rbac";

export default async function DashboardCompaniesPage() {
  await requireUserScope("COMPANY");
  redirect("/dashboard?access=company-management-moved-to-platform");
}
