import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/rbac";
import { listApprovalPolicies } from "@/lib/approvals/queries";
import {
  activateApprovalPolicy,
  deactivateApprovalPolicy,
  deleteApprovalPolicy,
} from "@/lib/actions/approval-policies";
import { CreatePolicyForm } from "@/components/approvals/create-policy-form";
import type { ApprovalDocumentType } from "@/lib/validators/approvals";

const DOCUMENT_TYPES: { key: ApprovalDocumentType; label: string }[] = [
  { key: "VENDOR_BILL", label: "Vendor bill approval policies" },
  { key: "PAYMENT", label: "Payment approval policies" },
];

const ROLE_LABELS: Record<string, string> = {
  COMPANY_ADMIN: "Company Admin / Owner",
  OPERATIONS_MANAGER: "Operations Manager",
  DOCUMENTATION_OFFICER: "Documentation Officer",
  ACCOUNTS_OFFICER: "Accounts Officer",
  SALES_EXECUTIVE: "Sales Executive",
};

export default async function ApprovalPoliciesPage() {
  const user = await requirePermission("approvalPolicies:manage");
  const companyId = user.companyId ?? "";
  const [policies, branches] = await Promise.all([
    listApprovalPolicies(companyId),
    prisma.branch.findMany({ where: { companyId, isActive: true, deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Approval Policies</h1>
        <p className="mt-1 text-sm text-slate-600">
          Require sign-off before a vendor bill is marked received, or before a payment above a threshold is
          cleared. With no active policy for a document type, nothing changes -- vendor bills and payments work
          exactly as before this feature existed.
        </p>
      </div>

      {DOCUMENT_TYPES.map(({ key, label }) => {
        const group = policies.filter((policy) => policy.documentType === key);
        return (
          <Card key={key}>
            <CardHeader>
              <CardTitle>{label}</CardTitle>
              <CardDescription>
                {group.some((policy) => policy.isActive)
                  ? "At least one policy is active for this document type."
                  : "No active policy -- approval is not required for this document type."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CreatePolicyForm documentType={key} branches={branches} />

              <div className="divide-y divide-slate-200 rounded-md border border-slate-200">
                {group.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No policies yet.</p>
                ) : (
                  group.map((policy) => {
                    const roleSequence = JSON.parse(policy.approverRoleSequence) as string[];
                    return (
                      <div key={policy.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                        <div>
                          <p className="font-medium text-slate-950">
                            {policy.name} {policy.isActive ? <Badge variant="success">Active</Badge> : null}
                          </p>
                          <p className="text-xs text-slate-500">
                            {policy.branch?.name ?? "All branches"} &middot; threshold {Number(policy.thresholdAmountBDT).toLocaleString("en-US", { minimumFractionDigits: 2 })} BDT
                          </p>
                          <p className="text-xs text-slate-500">
                            Steps: {roleSequence.map((code) => ROLE_LABELS[code] ?? code).join(" → ")}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {policy.isActive ? (
                            <form action={deactivateApprovalPolicy}>
                              <input type="hidden" name="id" value={policy.id} />
                              <Button type="submit" size="sm" variant="outline">Deactivate</Button>
                            </form>
                          ) : (
                            <form action={activateApprovalPolicy}>
                              <input type="hidden" name="id" value={policy.id} />
                              <Button type="submit" size="sm" variant="outline">Activate</Button>
                            </form>
                          )}
                          <form action={deleteApprovalPolicy}>
                            <input type="hidden" name="id" value={policy.id} />
                            <Button type="submit" size="sm" variant="destructive">Delete</Button>
                          </form>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </main>
  );
}
