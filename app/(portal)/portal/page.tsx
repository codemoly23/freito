import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function PortalRedirectPage() {
  const user = await getCurrentUser();
  if (user?.scope === "CLIENT" && user.companySlug) {
    redirect(`/portal/${user.companySlug}`);
  }
  redirect("/portal-login");
}
