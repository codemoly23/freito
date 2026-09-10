import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function statusVariant(status: string): "success" | "warning" | "danger" | "secondary" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED" || status === "CANCELLED") return "danger";
  if (status === "COMMITTING" || status === "VALIDATED") return "warning";
  return "secondary";
}

export default async function ImportsPage() {
  const user = await requirePermission("imports:csv");
  const companyId = user.companyId ?? "";
  const jobs = await prisma.importjob.findMany({
    where: { companyId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Data Import</h1>
          <p className="mt-1 text-sm text-slate-600">Import customers or vendors from a CSV file.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/imports/new">New import</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import jobs</CardTitle>
          <CardDescription>Every import run, its file, and its final counts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created / Skipped / Rejected</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 font-medium text-slate-950">{job.fileName}</td>
                    <td className="px-4 py-3">{job.entityType}</td>
                    <td className="px-4 py-3"><Badge variant={statusVariant(job.status)}>{job.status}</Badge></td>
                    <td className="px-4 py-3 text-slate-600">{job.createdCount} / {job.skippedCount} / {job.rejectedCount}</td>
                    <td className="px-4 py-3 text-slate-600">{job.user.name}</td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/imports/${job.id}`}>Open</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!jobs.length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No import jobs yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
