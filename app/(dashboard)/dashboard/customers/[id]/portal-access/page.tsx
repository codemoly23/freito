import Link from "next/link";
import { notFound } from "next/navigation";
import {
  createClientPortalAccount,
  deleteClientPortalAccount,
  resetClientPortalPassword,
  resendClientPortalInvitation,
  toggleClientPortalAccount,
  updateClientPortalAccount,
} from "@/lib/actions/client-portal";
import { hasModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { CreateClientPortalAccountForm, PortalInvitationForm, ResetClientPortalPasswordForm, UpdateClientPortalAccountForm } from "@/components/forms/client-portal-account-forms";
import { ClientPortalShareCard } from "@/components/portal/client-portal-share-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PageProps = { params: Promise<{ id: string }> };

export default async function CustomerPortalAccessPage({ params }: PageProps) {
  const user = await requirePermission("clientPortalAccounts:view");
  const { id } = await params;
  if (!user.companyId || !(await hasModuleAccess(user.companyId, "CLIENT_PORTAL"))) {
    notFound();
  }
  const customer = await prisma.customer.findFirst({
    where: { id, companyId: user.companyId, deletedAt: null },
    include: {
      company: { select: { name: true, portalSlug: true } },
      clientportalaccount: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        include: {
          customerportalactivationtoken: {
            where: { deletedAt: null, usedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          notificationdelivery: {
            where: {
              notificationtemplate: { key: { startsWith: "customer_portal_access" } },
              deletedAt: null,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
    },
  });
  if (!customer) notFound();
  const account = customer.clientportalaccount[0] ?? null;

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Button asChild variant="outline" size="sm"><Link href="/dashboard/customers">Back to customers</Link></Button>
        <h1 className="mt-4 text-2xl font-semibold">Client portal access</h1>
        <p className="mt-1 text-sm text-slate-600">{customer.name}</p>
      </div>
      {!account ? (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>Create portal account</CardTitle>
            <CardDescription>Client ID is generated automatically. The customer sets their own password using a single-use activation link.</CardDescription>
          </CardHeader>
          <CardContent>
            {hasPermission(user, "clientPortalAccounts:create") ? (
              <CreateClientPortalAccountForm action={createClientPortalAccount} customerId={customer.id} />
            ) : <p className="text-sm text-slate-500">You do not have create permission.</p>}
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{account.displayClientCode}</CardTitle>
              <CardDescription>Company-scoped client identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Badge variant={account.status === "ACTIVE" ? "success" : account.status === "DISABLED" ? "danger" : "warning"}>{account.status === "ACTIVE" ? "ACTIVATED" : account.status}</Badge>
              
              {/* Embedded Share Component inside Account Card */}
              <div className="rounded-lg border border-cyan-200 bg-cyan-50/40 p-3 space-y-2">
                <p className="font-semibold text-xs text-cyan-900 uppercase tracking-wider">Client Portal Login URL</p>
                <ClientPortalShareCard
                  customerName={customer.name}
                  companyName={customer.company?.name ?? "Freito"}
                  clientCode={account.displayClientCode}
                  portalSlug={customer.company?.portalSlug || "demo-freight"}
                  email={account.email}
                  phone={account.phone}
                  plainPassword={account.plainPassword}
                />
              </div>

                <p>Email: {account.email ?? "-"}</p>
                <p>Phone: {account.phone ?? "-"}</p>
                <p>Last login: {account.lastLoginAt?.toLocaleString() ?? "Never"}</p>
                <p>Activation expiry: {account.customerportalactivationtoken[0]?.expiresAt.toLocaleString() ?? "No active invitation"}</p>
                <p>Last sent: {account.notificationdelivery[0]?.createdAt.toLocaleString() ?? "Never"}</p>
                <div className="flex gap-2 pt-2">
                  {hasPermission(user, "clientPortalAccounts:update") ? (
                    <form action={toggleClientPortalAccount}>
                      <input type="hidden" name="id" value={account.id} />
                      <Button type="submit" variant="secondary">{account.status === "ACTIVE" ? "Suspend" : "Activate"}</Button>
                    </form>
                  ) : null}
                  {hasPermission(user, "clientPortalAccounts:delete") ? (
                    <form action={deleteClientPortalAccount}>
                      <input type="hidden" name="id" value={account.id} />
                      <Button type="submit" variant="destructive">Delete</Button>
                    </form>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            {hasPermission(user, "clientPortalAccounts:resetPassword") ? (
              <Card>
                <CardHeader><CardTitle>Portal invitation and access</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {hasPermission(user, "clientPortalAccounts:update") ? (
                    <UpdateClientPortalAccountForm action={updateClientPortalAccount} account={account} />
                  ) : null}
                  <ResetClientPortalPasswordForm action={resetClientPortalPassword} accountId={account.id} />
                  <PortalInvitationForm action={resendClientPortalInvitation} accountId={account.id} />
                  <div className="space-y-2">
                    <p className="font-medium">Delivery status</p>
                    {(["EMAIL", "WHATSAPP", "SMS"] as const).map((channel) => {
                      const delivery = account.notificationdelivery.find((item) => item.channel === channel);
                      return <div className="flex justify-between rounded-md border p-2 text-sm" key={channel}><span>{channel}</span><span>{delivery?.status ?? (channel === "EMAIL" && !account.email ? "MISSING RECIPIENT" : channel !== "EMAIL" && !account.phone ? "MISSING RECIPIENT" : "NOT SENT")}</span></div>;
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </section>
      )}
    </main>
  );
}
