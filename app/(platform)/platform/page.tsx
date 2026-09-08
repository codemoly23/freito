import Link from "next/link";
import { Building2, KeyRound, PackageCheck, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db/prisma";
import { requirePlatformPermission } from "@/lib/permissions/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PlatformDashboardPage() {
  await requirePlatformPermission("platform:companies:view");

  const [companyCount, activeCount, suspendedCount, moduleCount] = await Promise.all([
    prisma.company.count({ where: { deletedAt: null } }),
    prisma.company.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.company.count({ where: { deletedAt: null, status: "SUSPENDED" } }),
    prisma.companymoduleaccess.count({ where: { isEnabled: true } }),
  ]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold text-cyan-700">Platform Panel</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Operator dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage tenant lifecycle, license status, and module access outside company operations.
          </p>
        </div>
        <Button asChild>
          <Link href="/platform/companies">Manage companies</Link>
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={Building2} label="Companies" value={companyCount} />
        <Metric icon={ShieldCheck} label="Active" value={activeCount} />
        <Metric icon={KeyRound} label="Suspended" value={suspendedCount} />
        <Metric icon={PackageCheck} label="Enabled modules" value={moduleCount} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Architecture separation</CardTitle>
          <CardDescription>
            Platform users administer tenants here. Company users remain isolated inside /dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-950">SaaS Cloud</p>
            <p className="mt-1">Monthly/yearly tenant plans and module access.</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-950">Lifetime Cloud License</p>
            <p className="mt-1">Cloud-hosted lifetime access without billing implementation yet.</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-4">
            <p className="font-medium text-slate-950">Self-hosted later</p>
            <p className="mt-1">Schema-ready only. No self-hosted flows are built now.</p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
