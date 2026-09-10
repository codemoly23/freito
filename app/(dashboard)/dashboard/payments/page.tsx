import Link from "next/link";
import { deletePayment } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { billingStatusVariant, money, requireBillingPage } from "@/lib/billing/page-helpers";
import { hasPermission } from "@/lib/permissions/rbac";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/forms/shipment-forms";

export default async function PaymentsPage() {
  const { user, companyId, branchWhere } = await requireBillingPage("payments:view");
  const payments = await prisma.payment.findMany({ where: { companyId, deletedAt: null, ...branchWhere }, include: { customer: { select: { name: true } }, vendor: { select: { name: true } }, invoice: { select: { invoiceNo: true } }, vendorbill: { select: { billNo: true } } }, orderBy: { paymentDate: "desc" }, take: 100 });
  return <main className="space-y-6 p-4 lg:p-6"><div className="flex flex-wrap justify-between gap-3"><div><h1 className="mt-3 text-2xl font-semibold">Payments</h1></div><div className="flex gap-2">{hasPermission(user, "exports:csv") ? <Button asChild size="sm" variant="outline"><a download href="/api/exports/payments">Download CSV</a></Button> : null}{hasPermission(user, "payments:create") ? <><Button asChild><Link href="/dashboard/payments/received/new">Receive payment</Link></Button><Button asChild variant="outline"><Link href="/dashboard/payments/paid/new">Pay vendor</Link></Button></> : null}</div></div>
    <Card><CardHeader><CardTitle>Payment register</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Payment</th><th className="p-3">Party</th><th className="p-3">Document</th><th className="p-3">Amount</th><th className="p-3">BDT</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-b"><td className="p-3 font-medium">{payment.paymentNo}<div><Badge variant={billingStatusVariant(payment.status)}>{payment.direction} · {payment.status}</Badge></div></td><td className="p-3">{payment.customer?.name ?? payment.vendor?.name ?? "-"}</td><td className="p-3">{payment.invoice?.invoiceNo ?? payment.vendorbill?.billNo ?? "-"}</td><td className="p-3">{money(payment.amount, payment.currency)}</td><td className="p-3">{money(payment.amountInBDT)}</td><td className="p-3 text-right">{hasPermission(user, "payments:delete") ? <form action={deletePayment}><input type="hidden" name="id" value={payment.id} /><ConfirmDeleteButton label="Delete" message={`Reverse and delete ${payment.paymentNo}?`} /></form> : null}</td></tr>)}{!payments.length ? <tr><td colSpan={6} className="p-10 text-center text-slate-500">No payments found.</td></tr> : null}</tbody></table></div></CardContent></Card></main>;
}
