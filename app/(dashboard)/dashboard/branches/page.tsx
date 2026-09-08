import { notFound } from "next/navigation";
import { BranchForm, BranchMembershipForm } from "@/components/forms/branch-forms";
import { removeBranchMembership, saveBranch, saveBranchMembership, setBranchStatus } from "@/lib/actions/branches";
import { getScopedCompanyId } from "@/lib/actions/helpers";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { searchParams: Promise<{ edit?: string; branchError?: string }> };

const BRANCH_ERROR_MESSAGES: Record<string, string> = {
  "last-active": "Cannot deactivate: at least one branch must remain active for this company.",
  "has-default-members": "Cannot deactivate: one or more team members have this as their default branch. Reassign their default branch first, then try again.",
};

export default async function BranchesPage({ searchParams }: PageProps) {
  const { companyId } = await getScopedCompanyId("branches:view");
  const { edit, branchError } = await searchParams;
  const [branches, users, editing] = await Promise.all([
    prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      include: { userbranchmembership: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { isDefault: "desc" } } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    }),
    prisma.user.findMany({ where: { companyId, scope: "COMPANY", deletedAt: null, status: "ACTIVE" }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } }),
    edit ? prisma.branch.findFirst({ where: { id: edit, companyId, deletedAt: null } }) : null,
  ]);
  if (edit && !editing) notFound();
  const activeBranches = branches.filter((branch) => branch.isActive);

  return <main className="space-y-6 p-4 lg:p-6">
    <div><Badge variant="secondary">Branch management</Badge><h1 className="mt-3 text-2xl font-semibold text-slate-950">Branches</h1><p className="mt-1 text-sm text-slate-600">Manage operational locations and control which team members can use each location.</p></div>
    {branchError && BRANCH_ERROR_MESSAGES[branchError] ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{BRANCH_ERROR_MESSAGES[branchError]}</div> : null}
    <section className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>{editing ? "Edit branch" : "Create branch"}</CardTitle><CardDescription>Codes are unique within this company and cannot be reused by another active or archived branch.</CardDescription></CardHeader><CardContent><BranchForm action={saveBranch} branch={editing} /></CardContent></Card>
      <Card><CardHeader><CardTitle>Assign team access</CardTitle><CardDescription>Users need a branch membership. A default is used when a workflow has not selected a branch explicitly.</CardDescription></CardHeader><CardContent><BranchMembershipForm action={saveBranchMembership} users={users} branches={activeBranches} /></CardContent></Card>
    </section>
    <Card><CardHeader><CardTitle>Branch directory</CardTitle><CardDescription>Deactivation preserves branch history. At least one branch must remain active.</CardDescription></CardHeader><CardContent className="space-y-4">{branches.map((branch) => <div key={branch.id} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-semibold text-slate-950">{branch.name}</h2><Badge variant={branch.isActive ? "success" : "warning"}>{branch.isActive ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-sm text-slate-500">{branch.code}{branch.email ? ` · ${branch.email}` : ""}{branch.phone ? ` · ${branch.phone}` : ""}</p></div><div className="flex gap-2"><Button asChild size="sm" variant="outline"><a href={`/dashboard/branches?edit=${branch.id}`}>Edit</a></Button><form action={setBranchStatus}><input type="hidden" name="id" value={branch.id} /><input type="hidden" name="isActive" value={branch.isActive ? "false" : "true"} /><Button type="submit" size="sm" variant={branch.isActive ? "destructive" : "secondary"}>{branch.isActive ? "Deactivate" : "Activate"}</Button></form></div></div><div className="mt-4"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Assigned team members</p><div className="mt-2 flex flex-wrap gap-2">{branch.userbranchmembership.map((membership) => <div key={membership.id} className="flex items-center gap-2 rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700"><span>{membership.user.name}{membership.isDefault ? " (default)" : ""}</span>{!membership.isDefault ? <form action={removeBranchMembership}><input type="hidden" name="userId" value={membership.user.id} /><input type="hidden" name="branchId" value={branch.id} /><button className="text-xs text-red-700 underline" type="submit">Remove</button></form> : null}</div>)}{!branch.userbranchmembership.length ? <span className="text-sm text-slate-500">No team members assigned.</span> : null}</div></div></div>)}{!branches.length ? <p className="py-8 text-center text-sm text-slate-500">Create your first branch to start assigning team access.</p> : null}</CardContent></Card>
  </main>;
}
