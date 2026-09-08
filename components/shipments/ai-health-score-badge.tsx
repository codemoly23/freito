import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getShipmentHealthScore } from "@/lib/ai/health-score";
import { hasPermission } from "@/lib/permissions/rbac";

export async function AIHealthScoreBadge({
  shipmentId,
  companyId,
  user,
}: {
  shipmentId: string;
  companyId: string;
  user: { permissions?: string[] };
}) {
  if (!hasPermission(user, "ai:use")) return null;

  const result = await getShipmentHealthScore(shipmentId, companyId);
  if (!result) return null;

  const variant = result.score >= 80 ? "success" : result.score >= 50 ? "warning" : "danger";

  return (
    <details className="group inline-block">
      <summary className="inline-flex cursor-pointer list-none items-center">
        <Badge variant={variant} className="gap-1">
          <Sparkles className="h-3 w-3" />
          Health Score: {result.score}
        </Badge>
      </summary>
      <div className="z-10 mt-2 w-72 rounded-md border border-slate-200 bg-white p-3 text-xs shadow-lg">
        {result.factors.length === 0 ? (
          <p className="text-slate-500">No issues detected. This shipment looks healthy.</p>
        ) : (
          <ul className="space-y-1.5">
            {result.factors.map((factor) => (
              <li key={factor.label} className="flex items-start justify-between gap-2 text-slate-700">
                <span>{factor.label}</span>
                <span className="shrink-0 font-medium text-red-600">{factor.impact}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
