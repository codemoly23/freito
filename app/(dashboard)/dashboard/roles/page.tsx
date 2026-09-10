import { ShieldCheck } from "lucide-react";
import { RolePermissionsForm } from "@/components/forms/admin-action-forms";
import { updateRolePermissions } from "@/lib/actions/roles";
import { SEED_ONLY_PERMISSION_KEYS } from "@/lib/permissions/seed-only-permissions";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function RolesPage() {
  const currentUser = await requirePermission("roles:manage");

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      where: { companyId: currentUser.companyId },
      include: {
        company: true,
        rolepermission: { include: { permission: true } },
        _count: { select: { userrole: true } },
      },
      orderBy: [{ companyId: "asc" }, { code: "asc" }],
    }),
    prisma.permission.findMany({
      where: { key: { not: { startsWith: "platform:" }, notIn: SEED_ONLY_PERMISSION_KEYS } },
      orderBy: { key: "asc" },
    }),
  ]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 2</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">
          Roles & Permissions
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage access by assigning permission keys to system roles.
        </p>
      </div>

      <section className="grid gap-4">
        {roles.map((role) => {
          const selected = new Set(
            role.rolepermission.map((item) => item.permissionId),
          );

          return (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-slate-500" />
                      {role.name}
                    </CardTitle>
                    <CardDescription>
                      {role.code}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{role._count.userrole} users</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <RolePermissionsForm
                  action={updateRolePermissions}
                  roleId={role.id}
                  permissions={permissions}
                  selectedPermissionIds={Array.from(selected)}
                />
              </CardContent>
            </Card>
          );
        })}
      </section>
    </main>
  );
}
