import { OpeningBalancesForm } from "@/components/forms/accounting-forms";
import { saveOpeningBalances } from "@/lib/actions/accounting";
import { getScopedCompanyId } from "@/lib/actions/helpers";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";

export default async function OpeningBalancesPage() {
  const { companyId } = await getScopedCompanyId("accounts:manage");
  await requireModuleAccess(companyId, "BILLING");

  const [company, ledgerGroups] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { booksOpeningDate: true } }),
    prisma.ledgergroup.findMany({
      where: { companyId },
      include: { ledgeraccount: { where: { deletedAt: null }, orderBy: { name: "asc" } } },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const groups = ledgerGroups.map((group) => ({
    groupId: group.id,
    groupName: group.name,
    accounts: group.ledgeraccount.map((account) => ({
      id: account.id,
      name: account.name,
      openingBalance: account.openingBalance.toString(),
      openingBalanceSide: account.openingBalanceSide,
    })),
  }));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Chart of Accounts</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Opening balances</h1>
        <p className="mt-1 text-sm text-slate-600">
          One-time starting balance for every ledger — from your previous accounting records, as of the day you
          started using this system. New activity from that date forward is tracked automatically; only the
          starting point is entered here. Leave a ledger at 0.00 if it had no balance to carry forward.
        </p>
      </div>
      {!groups.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This company&apos;s chart of accounts hasn&apos;t been initialized yet. Ask a platform admin to use
          &quot;Initialize Accounting&quot; from Platform &rarr; Companies first.
        </div>
      ) : (
        <OpeningBalancesForm
          action={saveOpeningBalances}
          booksOpeningDate={company?.booksOpeningDate ? company.booksOpeningDate.toISOString().slice(0, 10) : ""}
          groups={groups}
        />
      )}
    </main>
  );
}
