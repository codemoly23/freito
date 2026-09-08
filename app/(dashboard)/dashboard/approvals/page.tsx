import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUserScope } from "@/lib/permissions/rbac";
import { getMyPendingApprovals } from "@/lib/approvals/queries";
import { DecideForm } from "@/components/approvals/decide-form";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function ApprovalsPage() {
  const user = await requireUserScope("COMPANY");
  const requests = await getMyPendingApprovals(user);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Approvals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vendor bills and payments waiting on your decision as the current step&apos;s approver.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending your decision</CardTitle>
          <CardDescription>You cannot approve or reject anything you submitted yourself.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing is waiting on your approval right now.</p>
          ) : (
            requests.map((request) => {
              const currentStep = request.approvalstep.find((step) => step.sequence === request.currentSequence);
              const isVendorBill = request.documentType === "VENDOR_BILL";
              const documentNo = isVendorBill ? request.vendorbill?.billNo : request.payment?.paymentNo;
              const label = isVendorBill ? "Vendor bill" : "Payment";
              const linkHref = isVendorBill && request.vendorBillId ? `/dashboard/vendor-bills/${request.vendorBillId}` : null;
              return (
                <div key={request.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">
                      {label} {linkHref ? <Link href={linkHref} className="text-cyan-600 hover:underline">{documentNo}</Link> : documentNo}
                      <Badge variant="secondary" className="ml-2">Step {request.currentSequence} of {request.approvalstep.length}</Badge>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Submitted by {request.user.name} on {request.submittedAt.toLocaleDateString()} &middot; {request.branch.name}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">Amount: {money(request.amountBDT)} BDT</p>
                  </div>
                  {currentStep ? <DecideForm requestId={request.id} /> : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </main>
  );
}
