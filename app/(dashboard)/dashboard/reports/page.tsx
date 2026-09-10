import Link from "next/link";
import { BarChart3, BookOpen, ClipboardList, FileCheck2, Landmark, Ship, Users, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { canAccessReportSection, requireReportsPage, type ReportSection } from "@/lib/reports/access";

const reports: {
  section: ReportSection;
  title: string;
  description: string;
  href: string;
  icon: typeof Ship;
}[] = [
  { section: "operations", title: "Operations Report", description: "Shipment workload, delay signals, service scope, and finance close readiness.", href: "/dashboard/reports/operations", icon: Ship },
  { section: "requests", title: "Shipment Request Reports", description: "Track portal demand, request statuses, and customer conversion performance.", href: "/dashboard/reports/requests", icon: ClipboardList },
  { section: "quotations", title: "Sales / Quotation Reports", description: "Sales pipeline, customer quotes, conversion status, and linked job files.", href: "/dashboard/reports/quotations", icon: BarChart3 },
  { section: "documents", title: "Document Reports", description: "Missing, verified, rejected, and client-visible freight documents.", href: "/dashboard/reports/documents", icon: FileCheck2 },
  { section: "workflow", title: "Workflow / Delivery Report", description: "Delivery order, gate pass, cargo release, POD, and job closeout progress.", href: "/dashboard/reports/workflow", icon: Workflow },
  { section: "financial", title: "Financial Reports", description: "Receivable, payable, final profit, and finance closeout overview.", href: "/dashboard/reports/financial", icon: Landmark },
  { section: "customers", title: "Customer Reports", description: "Customer shipment, quotation, invoicing, and receivable summaries.", href: "/dashboard/reports/customers", icon: Users },
  { section: "vendors", title: "Vendor Reports", description: "Vendor bills, payable balances, and assigned workflow activity.", href: "/dashboard/reports/vendors", icon: Users },
  { section: "accounting", title: "Trial Balance", description: "Every ledger's net debit/credit balance for the selected period.", href: "/dashboard/reports/accounting/trial-balance", icon: BookOpen },
  { section: "accounting", title: "Profit & Loss Statement", description: "Direct/indirect income and expense, gross and net profit.", href: "/dashboard/reports/accounting/profit-loss", icon: BookOpen },
  { section: "accounting", title: "Balance Sheet", description: "Assets vs. Liabilities & Equity as of the period end.", href: "/dashboard/reports/accounting/balance-sheet", icon: BookOpen },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ access?: string }>;
}) {
  const { user } = await requireReportsPage();
  const params = await searchParams;
  const visible = reports.filter((report) => canAccessReportSection(user, report.section));

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <div>
        <Badge variant="secondary">Report Center</Badge>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">Reports & Analytics</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Operational, financial, and document insight from your company&apos;s live data. Select a report section to explore KPIs, tables, and filters.
        </p>
      </div>
      {params.access === "denied" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your role does not have access to that report section. Ask an administrator for the right report permission if you need it.
        </div>
      ) : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((report) => (
          <Card key={report.href}>
            <CardHeader>
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                <report.icon className="h-5 w-5" />
              </div>
              <CardTitle>{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild size="sm" variant="outline"><Link href={report.href}>Open report</Link></Button>
            </CardContent>
          </Card>
        ))}
      </section>
      {!visible.length ? <p className="rounded-md border border-dashed p-8 text-center text-sm text-slate-500">No report sections are assigned to your role. Ask an administrator to review your report permissions.</p> : null}
    </main>
  );
}
