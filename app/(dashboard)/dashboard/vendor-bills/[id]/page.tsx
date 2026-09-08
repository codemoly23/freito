import Link from "next/link";
import { notFound } from "next/navigation";
import { updateVendorBillStatus } from "@/lib/actions/billing";
import { prisma } from "@/lib/db/prisma";
import { billingStatusVariant, getEffectiveVendorBillStatus, money, requireBillingPage } from "@/lib/billing/page-helpers";
import { hasPermission } from "@/lib/permissions/rbac";
import { getApprovalRequestForVendorBill } from "@/lib/approvals/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function VendorBillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, companyId, branchWhere } = await requireBillingPage("vendorBills:view");
  const { id } = await params;
  const bill = await prisma.vendorbill.findFirst({ where: { id, companyId, deletedAt: null, ...branchWhere }, include: { vendor: true, shipmentjob: { select: { jobNo: true } }, vendorbillline: { where: { deletedAt: null } }, payment: { where: { deletedAt: null }, orderBy: { paymentDate: "desc" } } } });
  if (!bill) notFound();
  const status = getEffectiveVendorBillStatus(bill);
  const approvalRequest = bill.status === "DRAFT" ? await getApprovalRequestForVendorBill(bill.id) : null;
  const approvalPending = approvalRequest?.status === "PENDING";
  return <main className="space-y-6 p-4 lg:p-6"><div className="flex justify-between"><div><Badge variant={billingStatusVariant(status)}>{status}</Badge>{approvalPending ? <Badge variant="warning">Pending approval</Badge> : null}{approvalRequest?.status === "REJECTED" ? <Badge variant="danger">Approval rejected</Badge> : null}<h1 className="mt-3 text-2xl font-semibold">{bill.billNo}</h1><p className="text-sm text-slate-500">{bill.vendor.name}</p>{approvalPending ? <p className="mt-1 text-xs text-slate-500">Waiting on step {approvalRequest.currentSequence} of the applicable approval policy. See <Link href="/dashboard/approvals" className="text-cyan-600 hover:underline">Approvals</Link>.</p> : null}{approvalRequest?.status === "REJECTED" ? <p className="mt-1 text-xs text-slate-500">The last approval request was rejected. Edit and click &quot;Mark received&quot; again to resubmit.</p> : null}</div><div className="flex gap-2">{hasPermission(user, "vendorBills:update") ? <Button asChild variant="outline"><Link href={`/dashboard/vendor-bills/${bill.id}/edit`}>Edit</Link></Button> : null}{hasPermission(user, "vendorBills:update") && bill.status === "DRAFT" && !approvalPending ? <StatusForm id={bill.id} status="RECEIVED" label="Mark received" /> : null}{hasPermission(user, "vendorBills:update") && !["PAID", "CANCELLED"].includes(bill.status) ? <StatusForm id={bill.id} status="CANCELLED" label="Cancel" /> : null}</div></div>
    <section className="grid gap-4 md:grid-cols-3"><Summary label="Total" value={money(bill.totalAmount, bill.currency)} /><Summary label="Paid" value={money(bill.paidAmount, bill.currency)} /><Summary label="Due" value={money(bill.dueAmount, bill.currency)} /></section>
    <Card><CardHeader><CardTitle>Bill lines</CardTitle></CardHeader><CardContent><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Description</th><th className="p-3">Qty</th><th className="p-3">Unit price</th><th className="p-3">Amount</th></tr></thead><tbody>{(bill.vendorbillline ?? []).map((line) => <tr key={line.id} className="border-b"><td className="p-3">{line.description}</td><td className="p-3">{String(line.quantity)}</td><td className="p-3">{money(line.unitPrice, bill.currency)}</td><td className="p-3">{money(line.amount, bill.currency)}</td></tr>)}</tbody></table></CardContent></Card>
    <Card><CardHeader><CardTitle>Payments</CardTitle></CardHeader><CardContent>{(bill.payment ?? []).map((payment) => <div key={payment.id} className="flex justify-between border-b p-3 text-sm"><span>{payment.paymentNo}</span><span>{money(payment.amount, payment.currency)}</span></div>)}{!(bill.payment ?? []).length ? <p className="text-sm text-slate-500">No payments recorded.</p> : null}</CardContent></Card></main>;
}
function StatusForm({ id, status, label }: { id: string; status: string; label: string }) { return <form action={updateVendorBillStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={status} /><Button type="submit" variant="outline">{label}</Button></form>; }
function Summary({ label, value }: { label: string; value: string }) { return <Card><CardContent className="p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></CardContent></Card>; }
