import { notFound } from "next/navigation";
import { LedgerAccountForm } from "@/components/forms/accounting-forms";
import { deleteLedgerAccount, saveLedgerAccount } from "@/lib/actions/accounting";
import { getScopedCompanyId } from "@/lib/actions/helpers";
import { requireModuleAccess } from "@/lib/access/company-access";
import { hasPermission } from "@/lib/permissions/rbac";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { searchParams: Promise<{ edit?: string }> };

export default async function LedgerAccountsPage({ searchParams }: PageProps) {
  const { user, companyId } = await getScopedCompanyId("ledgers:view");
  await requireModuleAccess(companyId, "BILLING");
  const canManage = hasPermission(user, "accounts:manage");
  const { edit } = await searchParams;

  const [groups, editing] = await Promise.all([
    prisma.ledgergroup.findMany({
      where: { companyId },
      include: { ledgeraccount: { where: { deletedAt: null }, orderBy: { name: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
    edit ? prisma.ledgeraccount.findFirst({ where: { id: edit, companyId, deletedAt: null } }) : null,
  ]);
  if (edit && !editing) notFound();

  const flatGroups = groups.map((group) => ({ id: group.id, name: group.name }));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Chart of Accounts</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Ledger accounts</h1>
        <p className="mt-1 text-sm text-slate-600">
          The accounts that Trial Balance, Profit &amp; Loss, and Balance Sheet reports are built from. Customer,
          vendor, bank/cash, and job-category accounts are managed automatically.
        </p>
      </div>
      {!groups.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This company&apos;s chart of accounts hasn&apos;t been initialized yet. Ask a platform admin to use
          &quot;Initialize Accounting&quot; from Platform &rarr; Companies first.
        </div>
      ) : null}
      {canManage && groups.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit ledger account" : "Add ledger account"}</CardTitle>
            <CardDescription>Custom accounts only — system accounts cannot be renamed or removed here.</CardDescription>
          </CardHeader>
          <CardContent>
            <LedgerAccountForm
              action={saveLedgerAccount}
              ledgerGroups={flatGroups}
              ledgerAccount={
                editing
                  ? {
                      id: editing.id,
                      ledgerGroupId: editing.ledgerGroupId,
                      name: editing.name,
                      openingBalance: editing.openingBalance.toString(),
                      openingBalanceSide: editing.openingBalanceSide,
                    }
                  : null
              }
            />
          </CardContent>
        </Card>
      ) : null}
      <div className="space-y-4">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader>
              <CardTitle className="text-base">{group.name}</CardTitle>
              <CardDescription>
                {group.natureType} · normal balance {group.normalBalance}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {group.ledgeraccount.length ? (
                <div className="divide-y divide-slate-100">
                  {group.ledgeraccount.map((account) => (
                    <div key={account.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <span className="font-medium text-slate-900">{account.name}</span>
                        {account.isSystemManaged ? (
                          <Badge variant="secondary" className="ml-2">
                            System
                          </Badge>
                        ) : null}
                      </div>
                      {canManage && !account.isSystemManaged ? (
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="outline">
                            <a href={`/dashboard/accounting/ledgers?edit=${account.id}`}>Edit</a>
                          </Button>
                          <form action={deleteLedgerAccount}>
                            <input type="hidden" name="id" value={account.id} />
                            <Button type="submit" size="sm" variant="destructive">
                              Delete
                            </Button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No ledger accounts under this group yet.</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
