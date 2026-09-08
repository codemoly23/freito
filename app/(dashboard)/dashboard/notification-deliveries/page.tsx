import Link from "next/link";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { sendNotificationDeliveryNow, updateNotificationDeliveryStatus } from "@/lib/actions/notification-deliveries";
import { deliveryDryRun } from "@/lib/communications/accounts";
import { prisma } from "@/lib/db/prisma";
import { notificationDeliveryAccessWhere } from "@/lib/notifications/delivery-access";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";

const channels = ["EMAIL", "WHATSAPP", "SMS"] as const;
const statuses = ["PENDING", "PROCESSING", "SENT", "FAILED", "CANCELLED", "SKIPPED"] as const;
const scopes = ["PLATFORM", "COMPANY", "CLIENT_PORTAL"] as const;

function validValue<T extends readonly string[]>(value: string | undefined, values: T) {
  return values.includes(value as T[number]) ? (value as T[number]) : undefined;
}

export default async function NotificationDeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; status?: string; scope?: string; from?: string; to?: string }>;
}) {
  const user = await requirePermission("notificationDeliveries:view");
  const companyId = user.companyId ?? "";
  const params = await searchParams;
  const channel = validValue(params.channel, channels);
  const status = validValue(params.status, statuses);
  const scope = validValue(params.scope, scopes);
  const createdAt: Prisma.DateTimeFilter = {};
  if (params.from && !Number.isNaN(Date.parse(params.from))) createdAt.gte = new Date(`${params.from}T00:00:00`);
  if (params.to && !Number.isNaN(Date.parse(params.to))) createdAt.lte = new Date(`${params.to}T23:59:59.999`);

  const [deliveries, communicationAccounts] = await Promise.all([
    prisma.notificationdelivery.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(channel ? { channel } : {}),
        ...(status ? { status } : {}),
        ...(scope ? { scope } : {}),
        ...(Object.keys(createdAt).length ? { createdAt } : {}),
        ...notificationDeliveryAccessWhere(user),
      },
      include: {
        notificationtemplate: { select: { key: true, name: true } },
        communicationaccount: { select: { displayName: true, provider: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.communicationaccount.findMany({
      where: { companyId, status: { not: "DISABLED" }, deletedAt: null },
      select: { id: true, displayName: true, channel: true, provider: true, isDefaultCompanyAccount: true },
      orderBy: [{ isDefaultCompanyAccount: "desc" }, { displayName: "asc" }],
    }),
  ]);
  const canManage = hasPermission(user, "notificationDeliveries:manage");
  const canSend = hasPermission(user, "communicationAccounts:send");

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Phase 8C</Badge>
        <h1 className="mt-3 text-2xl font-semibold">Delivery Outbox</h1>
        <p className="mt-1 text-sm text-slate-600">Prepared external notifications. No provider sends are active automatically; every send requires explicit manual approval.</p>
      </div>
      {deliveryDryRun() ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Dry-run enabled: Send Now simulates provider success without external delivery.</div> : null}
      <form className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-5">
        <select className="h-10 rounded-md border px-3 text-sm" defaultValue={channel ?? ""} name="channel">
          <option value="">All channels</option>
          {channels.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select className="h-10 rounded-md border px-3 text-sm" defaultValue={status ?? ""} name="status">
          <option value="">All statuses</option>
          {statuses.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select className="h-10 rounded-md border px-3 text-sm" defaultValue={scope ?? ""} name="scope">
          <option value="">All scopes</option>
          {scopes.map((value) => <option key={value}>{value}</option>)}
        </select>
        <Input defaultValue={params.from ?? ""} name="from" type="date" />
        <div className="flex gap-2"><Input defaultValue={params.to ?? ""} name="to" type="date" /><Button type="submit">Filter</Button></div>
      </form>
      <section className="space-y-3">
        {deliveries.map((delivery) => (
          <Card key={delivery.id}>
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[160px_1fr_auto]">
              <div className="space-y-2 text-sm">
                <p>{delivery.createdAt.toLocaleString()}</p>
                <div className="flex flex-wrap gap-2"><Badge variant="secondary">{delivery.channel}</Badge><Badge variant={delivery.status === "FAILED" ? "danger" : delivery.status === "SENT" ? "success" : "secondary"}>{delivery.status}</Badge></div>
                <p className="text-xs text-slate-500">{delivery.scope}</p>
              </div>
              <div className="min-w-0">
                <p className="font-semibold">{delivery.subject ?? delivery.notificationtemplate?.name ?? "Notification delivery"}</p>
                <p className="mt-1 text-sm text-slate-600">{delivery.recipientName ?? delivery.recipientEmail ?? delivery.recipientPhone ?? "Recipient unavailable"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{delivery.messageBody}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500"><span>Attempts: {delivery.attempts}</span>{delivery.communicationaccount ? <span>Source: {delivery.communicationaccount.displayName} ({delivery.communicationaccount.provider})</span> : delivery.provider ? <span>Provider: {delivery.provider}</span> : null}{delivery.errorMessage ? <span className="text-red-600">Error: {delivery.errorMessage}</span> : null}</div>
                {delivery.linkUrl ? <Link className="mt-2 inline-block text-sm font-medium text-cyan-700 hover:underline" href={delivery.linkUrl}>Open related record</Link> : null}
              </div>
              {canManage || canSend ? (
                <div className="flex flex-wrap gap-2 lg:flex-col">
                  {canSend && ["PENDING", "FAILED"].includes(delivery.status) ? (
                    <form action={sendNotificationDeliveryNow} className="space-y-2">
                      <input name="deliveryId" type="hidden" value={delivery.id} />
                      <select aria-label={`Provider account for ${delivery.subject ?? delivery.id}`} className="h-9 max-w-48 rounded-md border px-2 text-xs" defaultValue="" name="communicationAccountId">
                        <option value="">Default / environment</option>
                        {communicationAccounts.filter((account) => account.channel === delivery.channel).map((account) => (
                          <option key={account.id} value={account.id}>{account.displayName}{account.isDefaultCompanyAccount ? " (default)" : ""}</option>
                        ))}
                      </select>
                      <Button size="sm" type="submit">Send Now</Button>
                    </form>
                  ) : null}
                  {canManage && ["PENDING", "FAILED"].includes(delivery.status) ? <form action={updateNotificationDeliveryStatus}><input name="deliveryId" type="hidden" value={delivery.id} /><input name="action" type="hidden" value="CANCEL" /><Button size="sm" type="submit" variant="outline">Cancel</Button></form> : null}
                  {canManage && delivery.status === "FAILED" ? <form action={updateNotificationDeliveryStatus}><input name="deliveryId" type="hidden" value={delivery.id} /><input name="action" type="hidden" value="RESET" /><Button size="sm" type="submit" variant="outline">Reset pending</Button></form> : null}
                  {canManage && ["PENDING", "FAILED"].includes(delivery.status) ? <form action={updateNotificationDeliveryStatus}><input name="deliveryId" type="hidden" value={delivery.id} /><input name="action" type="hidden" value="MARK_SENT" /><Button size="sm" type="submit" variant="secondary">Mark sent</Button></form> : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {!deliveries.length ? <div className="rounded-md border border-dashed bg-white p-12 text-center text-sm text-slate-500">No delivery records found.</div> : null}
      </section>
    </main>
  );
}
