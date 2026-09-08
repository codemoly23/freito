import Link from "next/link";
import { Bell, PackagePlus, PackageSearch, ReceiptText, Files } from "lucide-react";
import { PortalHeader } from "@/components/portal/portal-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePortalAccount } from "@/lib/client-portal/access";
import { prisma } from "@/lib/db/prisma";
import { formatMoney } from "@/lib/pdf/formatters";

export default async function CompanyPortalHomePage({ params }: { params: Promise<{ companySlug: string }> }) {
  const { companySlug } = await params;
  const { account } = await requirePortalAccount(companySlug);
  const [company, activeShipments, pendingQuotations, invoices, unreadNotifications, recentNotifications, recentShipments, shipmentsForDocuments] = await Promise.all([
    prisma.company.findUnique({ where: { id: account.companyId }, select: { logoPath: true } }),
    prisma.shipmentjob.count({ where: { companyId: account.companyId, customerId: account.customerId, deletedAt: null, shipmentrequest: { clientPortalAccountId: account.id, deletedAt: null }, NOT: { currentStatus: { in: ["Delivered", "Closed"] } } } }),
    prisma.quotation.count({ where: { companyId: account.companyId, customerId: account.customerId, deletedAt: null, status: "SENT", shipmentrequest: { clientPortalAccountId: account.id, deletedAt: null } } }),
    prisma.invoice.findMany({ where: { companyId: account.companyId, customerId: account.customerId, deletedAt: null, status: { not: "CANCELLED" }, dueAmount: { gt: 0 } }, select: { dueAmount: true, currency: true } }),
    prisma.notification.count({ where: { companyId: account.companyId, clientPortalAccountId: account.id, scope: "CLIENT_PORTAL", deletedAt: null, readAt: null } }),
    prisma.notification.findMany({ where: { companyId: account.companyId, clientPortalAccountId: account.id, scope: "CLIENT_PORTAL", deletedAt: null }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, title: true, message: true, linkUrl: true, createdAt: true } }),
    prisma.shipmentjob.findMany({ where: { companyId: account.companyId, customerId: account.customerId, deletedAt: null, shipmentrequest: { clientPortalAccountId: account.id, deletedAt: null } }, orderBy: { updatedAt: "desc" }, take: 3, select: { id: true, jobNo: true, currentStatus: true, updatedAt: true } }),
    prisma.shipmentjob.findMany({ where: { companyId: account.companyId, customerId: account.customerId, deletedAt: null, shipmentrequest: { clientPortalAccountId: account.id, deletedAt: null } }, select: { shipmentType: true, shipmentdocument: { where: { deletedAt: null }, select: { checklistItemId: true, status: true } } } }),
  ]);
  const checklistByType = new Map<string, Array<{ id: string; isRequired: boolean }>>();
  for (const shipmentType of [...new Set(shipmentsForDocuments.map((shipment) => shipment.shipmentType))]) {
    checklistByType.set(shipmentType, await prisma.documentchecklistitem.findMany({ where: { isActive: true, isRequired: true, OR: [{ companyId: null }, { companyId: account.companyId }], category: { in: [shipmentType, "COMMON"] } }, select: { id: true, isRequired: true } }));
  }
  const missingDocuments = shipmentsForDocuments.reduce((total, shipment) => total + (checklistByType.get(shipment.shipmentType) ?? []).filter((item) => {
    const document = shipment.shipmentdocument.find((candidate) => candidate.checklistItemId === item.id);
    return !document || ["PENDING", "REJECTED"].includes(document.status);
  }).length, 0);
  const dueAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.dueAmount), 0);
  const currency = invoices[0]?.currency ?? "BDT";
  return <main className="min-h-screen bg-slate-50">
    <PortalHeader companySlug={companySlug} companyName={account.company.portalDisplayName ?? account.company.name} customerName={account.customer.name} clientCode={account.displayClientCode} hasLogo={Boolean(company?.logoPath)} mustChangePassword={account.mustChangePassword} />
    <section className="mx-auto max-w-6xl space-y-6 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi title="Active shipments" value={activeShipments} />
        <Kpi title="Pending quotations" value={pendingQuotations} />
        <Kpi title="Open invoices" value={invoices.length} subtitle={formatMoney(dueAmount, currency)} />
        <Kpi title="Missing documents" value={missingDocuments} />
        <Kpi title="Unread notifications" value={unreadNotifications} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <PortalLink icon={PackagePlus} title="Shipment Requests" description="Submit and review requests." href={`/portal/${companySlug}/requests`} />
        <PortalLink icon={PackageSearch} title="Shipments" description="Track milestones and documents." href={`/portal/${companySlug}/shipments`} />
        <PortalLink icon={Files} title="Documents" description="View documents by Job ID." href={`/portal/${companySlug}/documents`} />
        <PortalLink icon={ReceiptText} title="Invoices" description="Review balances and PDFs." href={`/portal/${companySlug}/invoices`} />
        <PortalLink icon={Bell} title="Notifications" description="Read customer updates." href={`/portal/${companySlug}/notifications`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card><CardHeader><CardTitle>Recent shipment updates</CardTitle></CardHeader><CardContent className="space-y-3">{recentShipments.map((shipment) => <Link className="block rounded-md border p-3 text-sm hover:bg-slate-50" href={`/portal/${companySlug}/shipments/${shipment.id}`} key={shipment.id}><span className="font-medium">{shipment.jobNo}</span><span className="float-right text-slate-500">{shipment.currentStatus ?? "In progress"}</span></Link>)}{!recentShipments.length ? <p className="text-sm text-slate-500">No shipment updates yet.</p> : null}</CardContent></Card>
        <Card><CardHeader><CardTitle>Recent notifications</CardTitle></CardHeader><CardContent className="space-y-3">{recentNotifications.map((notification) => <Link className="block rounded-md border p-3 text-sm hover:bg-slate-50" href={notification.linkUrl ?? `/portal/${companySlug}/notifications`} key={notification.id}><p className="font-medium">{notification.title}</p><p className="text-xs text-slate-500">{notification.message}</p></Link>)}{!recentNotifications.length ? <p className="text-sm text-slate-500">No notifications yet.</p> : null}</CardContent></Card>
      </div>
    </section>
  </main>;
}

function Kpi({ title, value, subtitle }: { title: string; value: number; subtitle?: string }) {
  return <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold">{value}</p>{subtitle ? <p className="text-xs text-slate-500">{subtitle} due</p> : null}</CardContent></Card>;
}

function PortalLink({ icon: Icon, title, description, href }: { icon: React.ComponentType<{ className?: string }>; title: string; description: string; href: string }) {
  return <Card><CardHeader><Icon className="h-5 w-5 text-cyan-600" /><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent><Link className="text-sm font-medium text-cyan-700 hover:underline" href={href}>Open {title.toLowerCase()}</Link></CardContent></Card>;
}
