import { JournalVoucherForm } from "@/components/forms/accounting-forms";
import { saveJournalVoucher } from "@/lib/actions/accounting";
import { getScopedCompanyId } from "@/lib/actions/helpers";
import { requireModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function JournalVouchersPage() {
  const { companyId } = await getScopedCompanyId("accounts:manage");
  await requireModuleAccess(companyId, "BILLING");

  const [ledgerAccountsRaw, entries] = await Promise.all([
    prisma.ledgeraccount.findMany({
      where: { companyId, deletedAt: null },
      include: { ledgergroup: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.journalentry.findMany({
      where: { companyId, voucherType: "JOURNAL", sourceType: "MANUAL_VOUCHER" },
      include: { journalentryline: { include: { ledgeraccount: { select: { name: true } } } } },
      orderBy: { entryDate: "desc" },
      take: 50,
    }),
  ]);

  const ledgerAccounts = ledgerAccountsRaw.map((account) => ({
    id: account.id,
    name: account.name,
    groupName: account.ledgergroup.name,
  }));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Chart of Accounts</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Journal vouchers</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manually record bank/cash movements, capital, loans, fixed assets, salary, and other entries that don&apos;t
          come from an invoice, vendor bill, or payment.
        </p>
      </div>
      {!ledgerAccounts.length ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This company&apos;s chart of accounts hasn&apos;t been initialized yet. Ask a platform admin to use
          &quot;Initialize Accounting&quot; from Platform &rarr; Companies first.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>New journal voucher</CardTitle>
            <CardDescription>Total debit must equal total credit before this can be posted.</CardDescription>
          </CardHeader>
          <CardContent>
            <JournalVoucherForm action={saveJournalVoucher} ledgerAccounts={ledgerAccounts} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Recent vouchers</CardTitle>
          <CardDescription>Latest 50 manual entries.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-md border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{entry.narration || "Journal voucher"}</span>
                <span className="text-xs text-slate-500">{entry.entryDate.toISOString().slice(0, 10)}</span>
              </div>
              <div className="mt-2 space-y-1">
                {entry.journalentryline.map((line) => (
                  <div key={line.id} className="flex justify-between text-xs text-slate-600">
                    <span>{line.ledgeraccount.name}</span>
                    <span>
                      {line.side} {line.nativeAmount.toString()} {line.nativeCurrency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!entries.length ? <p className="text-sm text-slate-500">No manual vouchers posted yet.</p> : null}
        </CardContent>
      </Card>
    </main>
  );
}
