import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { AlertTriangle, BarChart3, ClipboardList, FileClock, Landmark, PlusCircle, ReceiptText, Ship, Sparkles, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FloatingQuickActions } from "@/components/floating-quick-actions";
import { DashboardCustomizer } from "@/components/dashboard/dashboard-customizer";
import { hasModuleAccess } from "@/lib/access/company-access";
import { prisma } from "@/lib/db/prisma";
import { hasPermission, requirePermission } from "@/lib/permissions/rbac";
import { getManagementDashboardSummary } from "@/lib/reports/dashboard-summary";
import { getDeliveryReleaseSummary } from "@/lib/reports/delivery-summary";
import { reportDate, reportMoney } from "@/lib/reports/formatters";
import { branchScopeWhere, getAccessibleBranchIds } from "@/lib/access/branch-access";
import { getDashboardLayout } from "@/lib/dashboard/queries";
import type { DashboardWidgetKey } from "@/lib/dashboard/widgets";
import { getDelayRiskShipments } from "@/lib/ai/delay-risk";
import { getExceptionRadarFeed } from "@/lib/ai/exception-radar";
import { AISuggestedTasksSection } from "@/components/tasks/ai-suggested-tasks-section";

export default async function DashboardPage() {
  const user = await requirePermission("dashboard:view");
  const companyId = user.companyId ?? "";
  const branchWhere = branchScopeWhere(await getAccessibleBranchIds({ userId: user.id, companyId, permissions: user.permissions ?? [] }));
  const reportsEnabled = hasPermission(user, "reports:view") && await hasModuleAccess(companyId, "REPORTS");
  const financial = reportsEnabled && hasPermission(user, "reports:financial");

  if (!reportsEnabled) {
    const activeShipments = await prisma.shipmentjob.count({ where: { companyId, deletedAt: null, closedAt: null, ...branchWhere } });
    return (
      <main className="space-y-6 p-4 lg:p-6">
        <div><Badge variant="secondary">Control Tower</Badge><h1 className="mt-3 text-2xl font-semibold">Today&apos;s Operational Control Center</h1><p className="mt-1 text-sm text-slate-600">Monitor shipments, documents, delivery, finance closeout, and reports from one place. Full KPI analytics require the Reports module to be enabled for your company.</p></div>
        <Card><CardContent className="p-5"><p className="text-sm text-slate-500">Active shipments</p><p className="mt-2 text-3xl font-semibold">{activeShipments}</p><p className="mt-2 text-xs text-slate-500">Open job files currently available for operational follow-up.</p></CardContent></Card>
      </main>
    );
  }

  const [requestGroups, quotationGroups, shipments, managementSummary, deliverySummary, dashboardLayout, delayRisk, exceptionRadar] = await Promise.all([
    prisma.shipmentrequest.groupBy({ by: ["status"], where: { companyId, deletedAt: null, ...branchWhere }, _count: { _all: true } }),
    prisma.quotation.groupBy({ by: ["status"], where: { companyId, deletedAt: null, ...branchWhere }, _count: { _all: true } }),
    prisma.shipmentjob.findMany({
      where: { companyId, deletedAt: null, ...branchWhere },
      select: { id: true, jobNo: true, currentStatus: true, createdAt: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" }, take: 200,
    }),
    getManagementDashboardSummary(),
    getDeliveryReleaseSummary(),
    getDashboardLayout(companyId, user.id),
    getDelayRiskShipments(),
    getExceptionRadarFeed(),
  ]);

  const requestCounts = new Map(requestGroups.map((group) => [group.status, group._count._all]));
  const quotationCounts = new Map(quotationGroups.map((group) => [group.status, group._count._all]));
  const pendingRequests = (requestCounts.get("SUBMITTED") ?? 0) + (requestCounts.get("UNDER_REVIEW") ?? 0) + (requestCounts.get("REVISION_REQUESTED") ?? 0);
  const pendingQuotations = (quotationCounts.get("DRAFT") ?? 0) + (quotationCounts.get("SENT") ?? 0);
  const acceptedQuotations = quotationCounts.get("ACCEPTED") ?? 0;
  const convertedQuotations = quotationCounts.get("CONVERTED") ?? 0;

  const overviewCards = [
    { label: "Total Shipments", value: managementSummary.totalShipments, detail: "All job files in the reporting window.", href: "/dashboard/reports/operations", icon: Ship, theme: "blue" },
    { label: "Active Shipments", value: managementSummary.activeShipments, detail: "Operationally active jobs still moving.", href: "/dashboard/reports/operations", icon: Ship, theme: "blue" },
    { label: "Open Jobs", value: managementSummary.openJobs, detail: "Jobs not yet closed by operations.", href: "/dashboard/reports/operations", icon: Workflow, theme: "blue" },
    { label: "Closed Jobs", value: managementSummary.closedJobs, detail: "Jobs completed and closed by operations.", href: "/dashboard/reports/operations", icon: Workflow, theme: "blue" },
    { label: "Delayed Jobs", value: managementSummary.delayedJobs, detail: "Shipments that may need operational follow-up.", href: "/dashboard/reports/workflow", icon: AlertTriangle, theme: "amber" },
    { label: "Missing Documents", value: managementSummary.missingDocuments, detail: "Jobs that still need required shipping or client documents.", href: "/dashboard/reports/documents", icon: FileClock, theme: "amber" },
  ] as const;

  const workflowCards = [
    { label: "Pending Requests", value: pendingRequests, detail: "Customer requests waiting for review, revision, or action.", href: "/dashboard/reports/requests", icon: ClipboardList, theme: "purple" },
    { label: "Quotations Waiting", value: pendingQuotations, detail: "Draft or sent quotations waiting for the next sales step.", href: "/dashboard/reports/quotations", icon: ReceiptText, theme: "purple" },
    { label: "Accepted Quotes", value: acceptedQuotations, detail: "Quotes accepted by customers and ready for conversion.", href: "/dashboard/reports/quotations", icon: BarChart3, theme: "purple" },
    { label: "Converted to Job Files", value: convertedQuotations, detail: "Accepted quotes already converted into operational job files.", href: "/dashboard/reports/quotations", icon: Ship, theme: "purple" },
  ] as const;

  const operationalHealthCards = [
    { label: "Delayed Jobs", value: managementSummary.delayedJobs, detail: "Shipments that may need operational follow-up.", href: "/dashboard/reports/workflow", icon: AlertTriangle, theme: "amber" },
    { label: "Missing Documents", value: managementSummary.missingDocuments, detail: "Jobs that still need required shipping or client documents.", href: "/dashboard/reports/documents", icon: FileClock, theme: "amber" },
    { label: "Delivery/POD Pending", value: deliverySummary.podPending, detail: "Delivered jobs waiting for POD verification.", href: "/dashboard/reports/operations", icon: Ship, theme: "blue" },
    { label: "Finance Close Pending", value: managementSummary.financeClosePending, detail: "Jobs ready or waiting for final finance review.", href: "/dashboard/reports/financial", icon: Landmark, theme: "blue" },
    { label: "Delivered but Finance Open", value: managementSummary.deliveredButFinanceOpen, detail: "Delivered jobs waiting for finance closeout.", href: "/dashboard/reports/financial", icon: AlertTriangle, theme: "amber" },
  ] as const;

  const financeCards = [
    { label: "Monthly Revenue", value: reportMoney(managementSummary.monthlyRevenue), detail: "Customer invoice total in the reporting window", href: "/dashboard/reports/financial", icon: Landmark, theme: "emerald" },
    { label: "Monthly Gross Profit", value: reportMoney(managementSummary.monthlyGrossProfit), detail: "Final profit when locked, current profit otherwise", href: "/dashboard/reports/financial", icon: Landmark, theme: "emerald" },
    { label: "Pending Receivable", value: reportMoney(managementSummary.pendingReceivable), detail: "Customer payments still outstanding.", href: "/dashboard/reports/financial", icon: Landmark, theme: "emerald" },
    { label: "Pending Payable", value: reportMoney(managementSummary.pendingPayable), detail: "Vendor bills still outstanding.", href: "/dashboard/reports/financial", icon: Landmark, theme: "emerald" },
    { label: "Finance Locked Jobs", value: managementSummary.financeLockedJobs, detail: "Jobs with finalized finance", href: "/dashboard/reports/financial", icon: Landmark, theme: "emerald" },
    { label: "Low-margin Jobs", value: managementSummary.lowMarginJobs, detail: "Profit margin below 10%", href: "/dashboard/reports/financial", icon: AlertTriangle, theme: "amber" },
    { label: "Loss-making Jobs", value: managementSummary.lossMakingJobs, detail: "Gross profit below zero", href: "/dashboard/reports/financial", icon: AlertTriangle, theme: "rose" },
  ] as const;

  const quickActions = [
    { label: "New Shipment Request", description: "Capture a new customer request.", href: "/dashboard/shipment-requests/new", icon: ClipboardList, theme: "blue" as KpiTheme },
    { label: "New Shipment Job", description: "Create a job file for operations.", href: "/dashboard/shipments/new", icon: Ship, theme: "emerald" as KpiTheme },
    { label: "New Quotation", description: "Prepare pricing for a customer.", href: "/dashboard/quotations/new", icon: ReceiptText, theme: "amber" as KpiTheme },
    { label: "View Report Center", description: "Open KPI reports and operational tables.", href: "/dashboard/reports", icon: BarChart3, theme: "purple" as KpiTheme },
    ...(financial ? [{ label: "View Financial Reports", description: "Review receivable, payable, and closeout reports.", href: "/dashboard/reports/financial", icon: Landmark, theme: "rose" as KpiTheme }] : []),
  ];

  const widgetContent: Record<DashboardWidgetKey, ReactNode> = {
    "main-kpi": (
      <DashboardSection title="Main KPI Overview" description="Owner-level workload and closure signals.">
        {overviewCards.map((card) => <DashboardKpiCard key={card.label} {...card} />)}
      </DashboardSection>
    ),
    "finance-kpi": financial ? (
      <DashboardSection title="Finance KPI Section" description="Receivable, payable, profit, and finance closeout signals. Visible to users with financial report permission.">
        {financeCards.map((card) => <DashboardKpiCard key={card.label} {...card} />)}
      </DashboardSection>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>Finance KPI Section</CardTitle>
          <CardDescription>Financial KPIs are available to users with financial report permission. Contact your administrator to request access.</CardDescription>
        </CardHeader>
      </Card>
    ),
    "operational-health": (
      <DashboardSection title="Operational Health" description="Exceptions that should be handled before jobs feel truly done.">
        {operationalHealthCards.map((card) => <DashboardKpiCard key={card.label} {...card} />)}
      </DashboardSection>
    ),
    "sales-request-flow": (
      <DashboardSection title="Sales and Request Flow" description="Demand and quotation movement for the current company.">
        {workflowCards.map((card) => <DashboardKpiCard key={card.label} {...card} />)}
      </DashboardSection>
    ),
    "quick-actions": (
      <DashboardSection title="Quick Actions" description="Start common work or jump to the right report without hunting through menus.">
        {quickActions.map((action) => <QuickActionCard key={action.label} {...action} />)}
      </DashboardSection>
    ),
    "recent-shipments": (
      <Card>
        <CardHeader><CardTitle>Recent shipments</CardTitle><CardDescription>Latest shipment activity for this company.</CardDescription></CardHeader>
        <CardContent>
          {shipments.length > 0 ? (
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Job</th><th className="p-3">Customer</th><th className="p-3">Status</th><th className="p-3">Created</th><th className="p-3"></th></tr></thead><tbody>{shipments.slice(0, 10).map((shipment) => <tr className="border-b" key={shipment.id}><td className="p-3 font-medium">{shipment.jobNo}</td><td className="p-3">{shipment.customer.name}</td><td className="p-3"><Badge variant="secondary">{shipment.currentStatus ?? "Not set"}</Badge></td><td className="p-3">{reportDate(shipment.createdAt)}</td><td className="p-3 text-right"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/shipments/${shipment.id}`}>View</Link></Button></td></tr>)}</tbody></table></div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-200 p-6 text-sm text-slate-600">
              No recent shipments yet. Create a shipment job when operations are ready to start tracking work.
            </div>
          )}
        </CardContent>
      </Card>
    ),
    "ai-delay-alerts": delayRisk.enabled ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" />AI Delay Alerts</CardTitle>
          <CardDescription>Shipments that may be at risk of delay, based on ETA and workflow due dates.</CardDescription>
        </CardHeader>
        <CardContent>
          {delayRisk.items.length > 0 ? (
            <ul className="space-y-2">
              {delayRisk.items.slice(0, 5).map((item) => (
                <li key={item.shipmentId} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3 text-sm">
                  <div>
                    <Link href={item.href} className="font-medium text-slate-900 hover:underline">{item.jobNo}</Link>
                    <p className="text-xs text-slate-500">{item.customerName} — {item.reason}</p>
                  </div>
                  <Badge variant={item.level === "HIGH" ? "danger" : "warning"}>{item.level}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No shipments currently at risk of delay.</p>
          )}
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>AI Delay Alerts</CardTitle>
          <CardDescription>Ask an administrator for the &quot;ai:use&quot; permission to see AI-powered features.</CardDescription>
        </CardHeader>
      </Card>
    ),
    "ai-exception-radar": exceptionRadar.enabled ? (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" />AI Exception Radar</CardTitle>
          <CardDescription>Shipments, documents, and financial records that may need attention right now.</CardDescription>
        </CardHeader>
        <CardContent>
          {exceptionRadar.items.length > 0 ? (
            <ul className="space-y-2">
              {exceptionRadar.items.slice(0, 5).map((item) => (
                <li key={`${item.type}-${item.shipmentId}`} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3 text-sm">
                  <div>
                    <Link href={item.href} className="font-medium text-slate-900 hover:underline">{item.jobNo}</Link>
                    <p className="text-xs text-slate-500">{item.title}</p>
                  </div>
                  <Badge variant={item.severity === "HIGH" ? "danger" : "warning"}>{item.severity}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Nothing needs attention right now.</p>
          )}
          <Button asChild size="sm" variant="outline" className="mt-3">
            <Link href="/dashboard/exceptions">View all exceptions</Link>
          </Button>
        </CardContent>
      </Card>
    ) : (
      <Card>
        <CardHeader>
          <CardTitle>AI Exception Radar</CardTitle>
          <CardDescription>Ask an administrator for the &quot;ai:use&quot; permission to see AI-powered features.</CardDescription>
        </CardHeader>
      </Card>
    ),
    "ai-task-suggestions": <AISuggestedTasksSection />,
  };
  const visibleWidgetOrder = dashboardLayout.order.filter((key) => !dashboardLayout.hidden.includes(key));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0f172a] via-[#1e1b4b] to-[#0f172a] p-6 text-[#ffffff] shadow-xl shadow-slate-950/20 lg:p-8">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute left-0 bottom-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        
        <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/20">
              Control Tower
            </span>
            <h1 className="text-3xl font-bold tracking-tight text-[#ffffff] sm:text-4xl">
              Today&apos;s Operational Control Center
            </h1>
            <p className="max-w-2xl text-sm text-[#cbd5e1] leading-relaxed">
              Monitor shipments, documents, delivery, finance closeout, and reports from one unified command console.
            </p>
          </div>
          <Button asChild className="shrink-0 bg-cyan-500 text-[#0f172a] hover:bg-cyan-400 font-semibold shadow-md transition-all duration-200 hover:scale-105 active:scale-95 border-none">
            <Link href="/dashboard/reports">
              <BarChart3 className="mr-1.5 h-4 w-4 text-[#0f172a]" />
              <span className="text-[#0f172a]">Open Analytics Center</span>
            </Link>
          </Button>
        </div>
      </div>

      <DashboardCustomizer
        key={`${dashboardLayout.order.join(",")}|${dashboardLayout.hidden.join(",")}`}
        initialOrder={dashboardLayout.order}
        initialHidden={dashboardLayout.hidden}
      />

      {visibleWidgetOrder.map((key) => <Fragment key={key}>{widgetContent[key]}</Fragment>)}

      <FloatingQuickActions financial={financial} />
    </main>
  );
}

function DashboardSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

type KpiTheme = "blue" | "emerald" | "amber" | "rose" | "purple";

const themes = {
  blue: {
    border: "border-l-4 border-l-blue-500",
    bg: "bg-gradient-to-br from-blue-50/40 to-slate-50/10 dark:from-[#0f172a] dark:to-[#1e293b]",
    iconBg: "bg-blue-100/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    btn: "hover:bg-blue-600 hover:text-white hover:border-blue-600 dark:hover:bg-blue-500 dark:hover:text-white dark:border-slate-800",
  },
  emerald: {
    border: "border-l-4 border-l-emerald-500",
    bg: "bg-gradient-to-br from-emerald-50/40 to-slate-50/10 dark:from-[#0f172a] dark:to-[#1e293b]",
    iconBg: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    btn: "hover:bg-emerald-600 hover:text-white hover:border-emerald-600 dark:hover:bg-emerald-500 dark:hover:text-white dark:border-slate-800",
  },
  amber: {
    border: "border-l-4 border-l-amber-500",
    bg: "bg-gradient-to-br from-amber-50/40 to-slate-50/10 dark:from-[#0f172a] dark:to-[#1e293b]",
    iconBg: "bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    btn: "hover:bg-amber-600 hover:text-white hover:border-amber-600 dark:hover:bg-amber-500 dark:hover:text-white dark:border-slate-800",
  },
  rose: {
    border: "border-l-4 border-l-rose-500",
    bg: "bg-gradient-to-br from-rose-50/40 to-slate-50/10 dark:from-[#0f172a] dark:to-[#1e293b]",
    iconBg: "bg-rose-100/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    btn: "hover:bg-rose-600 hover:text-white hover:border-rose-600 dark:hover:bg-rose-500 dark:hover:text-white dark:border-slate-800",
  },
  purple: {
    border: "border-l-4 border-l-purple-500",
    bg: "bg-gradient-to-br from-purple-50/40 to-slate-50/10 dark:from-[#0f172a] dark:to-[#1e293b]",
    iconBg: "bg-purple-100/80 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    btn: "hover:bg-purple-600 hover:text-white hover:border-purple-600 dark:hover:bg-purple-500 dark:hover:text-white dark:border-slate-800",
  },
};

const quickActionThemes = {
  blue: {
    border: "hover:border-blue-400 dark:hover:border-blue-500/50",
    iconBg: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
    btn: "bg-blue-600 hover:bg-blue-700 shadow-blue-200/50 hover:shadow-blue-300/60 dark:bg-blue-600 dark:hover:bg-blue-500",
    glow: "bg-blue-500/5",
  },
  emerald: {
    border: "hover:border-emerald-400 dark:hover:border-emerald-500/50",
    iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
    btn: "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200/50 hover:shadow-emerald-300/60 dark:bg-emerald-600 dark:hover:bg-emerald-500",
    glow: "bg-emerald-500/5",
  },
  amber: {
    border: "hover:border-amber-400 dark:hover:border-amber-500/50",
    iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    btn: "bg-amber-600 hover:bg-amber-700 shadow-amber-200/50 hover:shadow-amber-300/60 dark:bg-amber-600 dark:hover:bg-amber-500",
    glow: "bg-amber-500/5",
  },
  purple: {
    border: "hover:border-purple-400 dark:hover:border-purple-500/50",
    iconBg: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400",
    btn: "bg-purple-600 hover:bg-purple-700 shadow-purple-200/50 hover:shadow-purple-300/60 dark:bg-purple-600 dark:hover:bg-purple-500",
    glow: "bg-purple-500/5",
  },
  rose: {
    border: "hover:border-rose-400 dark:hover:border-rose-500/50",
    iconBg: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
    btn: "bg-rose-600 hover:bg-rose-700 shadow-rose-200/50 hover:shadow-rose-300/60 dark:bg-rose-600 dark:hover:bg-rose-500",
    glow: "bg-rose-500/5",
  },
};

function DashboardKpiCard({
  label,
  value,
  detail,
  href,
  icon: Icon,
  theme = "blue",
}: {
  label: string;
  value: ReactNode;
  detail: string;
  href: string;
  icon: typeof Ship;
  theme?: KpiTheme;
}) {
  const styles = themes[theme] || themes.blue;
  return (
    <Card className={`group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${styles.border} ${styles.bg}`}>
      <CardContent className="p-5">
        <div className="flex justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${styles.iconBg}`}>
            <Icon className="h-5.5 w-5.5" />
          </div>
        </div>
        <p className="mt-3 min-h-8 text-xs text-slate-600 line-clamp-2 leading-relaxed">{detail}</p>
        <Button asChild size="sm" variant="outline" className={`mt-4 w-full justify-between transition-all duration-200 ${styles.btn}`}>
          <Link href={href}>
            <span>Open report</span>
            <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function QuickActionCard({
  label,
  description,
  href,
  icon: Icon,
  theme = "blue",
}: {
  label: string;
  description: string;
  href: string;
  icon: typeof Ship;
  theme?: KpiTheme;
}) {
  const styles = quickActionThemes[theme] || quickActionThemes.blue;
  return (
    <Card className={`group relative overflow-hidden border border-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${styles.border}`}>
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl transition-all duration-500 group-hover:scale-125 ${styles.glow}`} />
      <CardContent className="flex h-full flex-col justify-between gap-5 p-5 relative z-10">
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 ${styles.iconBg}`}>
            <Icon className="h-5.5 w-5.5" />
          </div>
          <div>
            <p className="text-base font-bold tracking-tight text-slate-900">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
          </div>
        </div>
        <Button asChild size="sm" className={`w-full font-semibold shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-95 text-[#ffffff] ${styles.btn}`}>
          <Link href={href}>
            <PlusCircle className="mr-1.5 h-4 w-4 text-[#ffffff]" />
            <span className="text-[#ffffff]">{label}</span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
