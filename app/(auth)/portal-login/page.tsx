import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, UserRoundCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function PortalLoginPage() {
  const user = await getCurrentUser();

  if (user?.scope === "CLIENT") {
    redirect("/portal");
  }

  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, portalSlug: true, portalDisplayName: true },
  });

  return (
    <main
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-10"
      style={{
        backgroundImage: "url('/images/client-portal-login-hero.png')",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0 bg-slate-950/45" />
      <Card className="relative z-10 w-full max-w-md border-white/15 bg-white/95 shadow-2xl backdrop-blur">
        <CardHeader>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-white">
            <UserRoundCheck className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Client Portal Login</CardTitle>
          <CardDescription>
            Select your freight forwarding partner portal below to log in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {companies.map((c) => {
              const slug = c.portalSlug || "demo-freight";
              return (
                <Link
                  key={c.id}
                  href={`/portal/${slug}/login`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm transition-all hover:border-cyan-600 hover:bg-cyan-50/50 group"
                >
                  <div>
                    <p className="font-semibold text-slate-900 group-hover:text-cyan-900">
                      {c.portalDisplayName || c.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      /portal/{slug}/login
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-600 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 text-center pt-2">
            Need access? Contact your freight forwarder account officer.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
