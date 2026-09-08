import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.scope === "PLATFORM") redirect("/platform");
  if (user.scope === "CLIENT") redirect("/portal");
  redirect("/dashboard");
}
