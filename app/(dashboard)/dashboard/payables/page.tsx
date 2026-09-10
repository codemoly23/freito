import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { billingStatusVariant, getEffectiveVendorBillStatus, money, requireBillingPage } from "@/lib/billing/page-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PayablesPage() {
  const { companyId, branchWhere } = await requireBillingPage("payables:view");
  const bills = await prisma.vendorbill.findMany({ where: { companyId, deletedAt: null, dueAmount: { gt: 0 }, status: { not: "CANCELLED" }, ...branchWhere }, include: { vendor: { select: { name: true } } }, orderBy: [{ dueDate: "asc" }, { billDate: "asc" }] });
  const total = bills.reduce((sum, bill) => sum + Number(bill.dueAmount) * Number(bill.exchangeRateToBDT), 0);
  return <main className="space-y-6 p-4 lg:p-6"><div><h1 className="mt-3 text-2xl font-semibold">Payables</h1><p className="text-sm text-slate-500">Outstanding vendor bills. BDT equivalent due: {money(total)}</p></div><Card><CardHeader><CardTitle>Open vendor bills</CardTitle></CardHeader><CardContent><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Bill</th><th className="p-3">Vendor</th><th className="p-3">Due date</th><th className="p-3">Outstanding</th><th className="p-3"></th></tr></thead><tbody>{bills.map((bill) => {
    const status = getEffectiveVendorBillStatus(bill);
    return <tr key={bill.id} className="border-b"><td className="p-3">{bill.billNo}<div><Badge variant={billingStatusVariant(status)}>{status}</Badge></div></td><td className="p-3">{bill.vendor.name}</td><td className="p-3">{bill.dueDate?.toLocaleDateString() ?? "-"}</td><td className="p-3">{money(bill.dueAmount, bill.currency)}</td><td className="p-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/vendor-bills/${bill.id}`}>View</Link></Button></td></tr>;
  })}</tbody></table></CardContent></Card></main>;
}
