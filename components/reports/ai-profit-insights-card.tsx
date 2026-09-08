import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLowMarginShipments } from "@/lib/ai/profit-analysis";
import { reportMoney, reportPercent } from "@/lib/reports/formatters";

export async function AIProfitInsightsCard() {
  const result = await getLowMarginShipments();
  if (!result.enabled) return null; // ai:use missing or no permission -- hide silently, this section is a bonus on top of the report above

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" />AI Profit Analysis</CardTitle>
        <CardDescription>
          Shipments losing money or earning well below the company&apos;s average margin of {reportPercent(result.companyAverageMargin)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {result.items.length > 0 ? (
          <ul className="space-y-2">
            {result.items.slice(0, 10).map((item) => (
              <li key={item.shipmentId} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 p-3 text-sm">
                <div>
                  <Link href={item.href} className="font-medium text-slate-900 hover:underline">{item.jobNo}</Link>
                  <p className="text-xs text-slate-500">{item.customerName} — {item.reason}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600">{reportMoney(item.profit)}</span>
                  <Badge variant={item.profit < 0 ? "danger" : "warning"}>{reportPercent(item.marginPercent)}</Badge>
                  <Button asChild size="sm" variant="outline"><Link href={item.href}>View</Link></Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No shipments are currently flagged as low-margin or loss-making.</p>
        )}
      </CardContent>
    </Card>
  );
}
