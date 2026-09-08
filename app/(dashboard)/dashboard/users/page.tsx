import { notFound } from "next/navigation";
import { UserForm } from "@/components/forms/admin-action-forms";
import { deleteUser, saveUser } from "@/lib/actions/users";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PageProps = {
  searchParams: Promise<{ q?: string; edit?: string }>;
};

export default async function UsersPage({ searchParams }: PageProps) {
  const currentUser = await requirePermission("users:manage");
  const { q = "", edit } = await searchParams;
  const isSuperAdmin = currentUser.roles.includes("SUPER_ADMIN");
  const companyWhere = isSuperAdmin ? {} : { id: currentUser.companyId ?? "" };

  const [companies, roles, users, editing] = await Promise.all([
    prisma.company.findMany({
      where: { ...companyWhere, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      where: companyWhere,
      include: { company: true },
      orderBy: [{ companyId: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(isSuperAdmin ? {} : { companyId: currentUser.companyId }),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { designation: { contains: q } },
              ],
            }
          : {}),
      },
      include: { company: true, userrole: { include: { role: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    edit
      ? isSuperAdmin
        ? prisma.user.findUnique({
            where: { id: edit },
            include: { userrole: true },
          })
        : prisma.user.findFirst({
            where: { id: edit, companyId: currentUser.companyId ?? "" },
            include: { userrole: true },
          })
      : null,
  ]);

  if (edit && !editing) notFound();

  const selectedRoleIds = editing?.userrole.map((item) => item.roleId) ?? [];
  const defaultCompanyId =
    editing?.companyId ?? currentUser.companyId ?? companies[0]?.id ?? "";

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 2</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Users</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage team members, roles, and login status.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit User" : "Create User"}</CardTitle>
            <CardDescription>
              New users get a password from this form.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserForm
              action={saveUser}
              editing={editing}
              companies={companies}
              roles={roles}
              isSuperAdmin={isSuperAdmin}
              defaultCompanyId={defaultCompanyId}
              selectedRoleIds={selectedRoleIds}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User List</CardTitle>
            <CardDescription>Showing latest 50 active records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="flex gap-2">
              <Input name="q" placeholder="Search user" defaultValue={q} />
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Company</th>
                    <th className="px-4 py-3">Roles</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {users.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-950">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.email}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{item.company?.name ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.userrole.map((role) => role.role.name).join(", ") || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.status === "ACTIVE" ? "success" : "warning"}>
                          {item.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a href={`/dashboard/users?edit=${item.id}`}>Edit</a>
                          </Button>
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={item.id} />
                            <Button type="submit" size="sm" variant="destructive">Delete</Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!users.length ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
