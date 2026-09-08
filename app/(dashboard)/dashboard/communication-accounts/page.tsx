import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  manageCommunicationAccount,
  testCommunicationAccount,
} from "@/lib/actions/communication-accounts";
import { deliveryDryRun } from "@/lib/communications/accounts";
import { canStartQrSession } from "@/lib/communications/providers/whatsapp-web-qr";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";

export default async function CommunicationAccountsPage() {
  const user = await requirePermission("communicationAccounts:view");
  const companyId = user.companyId ?? "";
  const accounts = await prisma.communicationaccount.findMany({
    where: { companyId, deletedAt: null },
    include: { user: { select: { name: true } } },
    orderBy: [{ isDefaultCompanyAccount: "desc" }, { createdAt: "desc" }],
  });
  const canConnect = hasPermission(user, "communicationAccounts:connect");
  const canTest = hasPermission(user, "communicationAccounts:test");
  const canManage = hasPermission(user, "communicationAccounts:manage");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Badge variant="secondary">Phase 8C</Badge>
          <h1 className="mt-3 text-2xl font-semibold">Communication Accounts</h1>
          <p className="mt-1 text-sm text-slate-600">Company and employee-owned SMTP and WhatsApp provider connections.</p>
        </div>
        {canConnect ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link href="/dashboard/communication-accounts/new/email">Add Email SMTP</Link></Button>
            <Button asChild variant="outline"><Link href="/dashboard/communication-accounts/new/whatsapp-cloud">Add WhatsApp Cloud API</Link></Button>
            {canStartQrSession() ? <Button asChild variant="outline"><Link href="/dashboard/communication-accounts/new/whatsapp-qr">Connect WhatsApp by QR</Link></Button> : null}
          </div>
        ) : null}
      </div>
      {deliveryDryRun() ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Delivery dry-run is enabled. Tests and manual sends are simulated.</div> : null}
      <section className="space-y-3">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{account.displayName}</p>
                  <Badge variant="secondary">{account.provider}</Badge>
                  <Badge variant="secondary">{account.channel}</Badge>
                  <Badge variant={account.status === "CONNECTED" ? "success" : account.status === "FAILED" ? "danger" : "secondary"}>{account.status}</Badge>
                  {account.isDefaultCompanyAccount ? <Badge variant="success">Default</Badge> : null}
                </div>
                <dl className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  <div><dt className="font-medium text-slate-900">Owner</dt><dd>{account.isUserOwned ? account.user?.name ?? "Employee" : "Company"}</dd></div>
                  <div><dt className="font-medium text-slate-900">Sender</dt><dd>{account.senderEmail ?? account.senderPhone ?? "Configured provider identity"}</dd></div>
                  <div><dt className="font-medium text-slate-900">Last connected</dt><dd>{account.lastConnectedAt?.toLocaleString() ?? "Never"}</dd></div>
                  <div><dt className="font-medium text-slate-900">Configuration</dt><dd>{account.encryptedConfig ? "Credentials stored securely" : "Dry-run metadata only"}</dd></div>
                </dl>
                {account.lastError ? <p className="mt-3 text-sm text-amber-700">{account.lastError}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 lg:max-w-48 lg:flex-col">
                {canTest && account.status !== "DISABLED" ? <form action={testCommunicationAccount}><input name="accountId" type="hidden" value={account.id} /><Button size="sm" type="submit" variant="outline">Test connection</Button></form> : null}
                {canManage && !account.isDefaultCompanyAccount && account.status !== "DISABLED" ? <form action={manageCommunicationAccount}><input name="accountId" type="hidden" value={account.id} /><input name="action" type="hidden" value="DEFAULT" /><Button size="sm" type="submit" variant="outline">Set default</Button></form> : null}
                {canManage && account.status !== "DISABLED" ? <form action={manageCommunicationAccount}><input name="accountId" type="hidden" value={account.id} /><input name="action" type="hidden" value="DISABLE" /><Button size="sm" type="submit" variant="outline">Disable</Button></form> : null}
                {canManage ? <form action={manageCommunicationAccount}><input name="accountId" type="hidden" value={account.id} /><input name="action" type="hidden" value="DISCONNECT" /><Button size="sm" type="submit" variant="destructive">Disconnect</Button></form> : null}
              </div>
            </CardContent>
          </Card>
        ))}
        {!accounts.length ? <div className="rounded-md border border-dashed bg-white p-12 text-center text-sm text-slate-500">No communication accounts configured.</div> : null}
      </section>
    </main>
  );
}
