import { ExchangeRateForm } from "@/components/forms/platform-forms";
import { saveExchangeRate } from "@/lib/actions/exchange-rates";
import { listLatestExchangeRates } from "@/lib/accounting/exchange-rates";
import { requirePlatformPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ExchangeRatesPage() {
  await requirePlatformPermission("platform:companies:view");
  const rates = await listLatestExchangeRates();

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Platform</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Exchange rates</h1>
        <p className="mt-1 text-sm text-slate-600">
          Currency-to-USD rates used to convert every company&apos;s ledger amounts for cross-currency and audit
          reporting. USD itself never needs a row. Add a new row for a currency to update its rate going forward —
          older journal entries keep the rate that was in effect when they were posted.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Add / update a rate</CardTitle>
          <CardDescription>
            Enter how many US dollars one unit of the currency is worth as of the effective date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExchangeRateForm action={saveExchangeRate} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Current rates</CardTitle>
          <CardDescription>Latest rate on file per currency.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Currency</th>
                  <th className="px-4 py-3">Rate to USD</th>
                  <th className="px-4 py-3">Effective date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rates.map((rate) => (
                  <tr key={rate.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{rate.currency}</td>
                    <td className="px-4 py-3 text-slate-700">{rate.rateToUSD.toString()}</td>
                    <td className="px-4 py-3 text-slate-500">{rate.effectiveDate.toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
                {!rates.length ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                      No exchange rates entered yet. Companies whose base currency isn&apos;t USD or BDT will show a
                      placeholder USD figure until a rate is added here.
                    </td>
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
