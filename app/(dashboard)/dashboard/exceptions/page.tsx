import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportHeader } from "@/components/reports/report-ui";
import { getExceptionRadarFeed } from "@/lib/ai/exception-radar";

const typeLabels: Record<string, string> = {
  DELAY: "Delay Risk",
  LOW_MARGIN: "Profit",
  REJECTED_DOCUMENT: "Document",
};

export default async function ExceptionRadarPage() {
  const result = await getExceptionRadarFeed();

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <ReportHeader
        title="AI Exception Radar"
        description="Shipments, documents, and financial records that may need attention right now, gathered from delay risk, profit analysis, and document verification signals."
      />
      {!result.enabled ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">
            AI-powered features are not enabled for your account. Ask an administrator to grant the &quot;ai:use&quot; permission.
          </CardContent>
        </Card>
      ) : result.items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-slate-600">Nothing needs attention right now.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {result.items.map((item) => (
            <Card key={`${item.type}-${item.shipmentId}-${item.title}`}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Badge variant={item.severity === "HIGH" ? "danger" : "warning"}>{item.severity}</Badge>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{typeLabels[item.type] ?? item.type}</p>
                    <Link href={item.href} className="font-medium text-slate-900 hover:underline">{item.jobNo}</Link>
                    <p className="text-sm text-slate-600">{item.title}</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline"><Link href={item.href}>Open</Link></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
