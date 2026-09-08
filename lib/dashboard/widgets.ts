export const DASHBOARD_WIDGET_KEYS = [
  "main-kpi",
  "finance-kpi",
  "operational-health",
  "sales-request-flow",
  "quick-actions",
  "recent-shipments",
  "ai-delay-alerts",
  "ai-exception-radar",
  "ai-task-suggestions",
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGET_KEYS)[number];

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  "main-kpi": "Main KPI Overview",
  "finance-kpi": "Finance KPI Section",
  "operational-health": "Operational Health",
  "sales-request-flow": "Sales and Request Flow",
  "quick-actions": "Quick Actions",
  "recent-shipments": "Recent Shipments",
  "ai-delay-alerts": "AI Delay Alerts",
  "ai-exception-radar": "AI Exception Radar",
  "ai-task-suggestions": "AI Task Suggestions",
};

export function isDashboardWidgetKey(value: string): value is DashboardWidgetKey {
  return (DASHBOARD_WIDGET_KEYS as readonly string[]).includes(value);
}

export type DashboardLayout = {
  order: DashboardWidgetKey[];
  hidden: DashboardWidgetKey[];
};

/**
 * Reconciles a saved layout against the current widget registry. Unknown keys
 * (a widget removed/renamed since the layout was saved) are silently dropped;
 * any registry widget missing from the saved order (added after the layout was
 * saved) is appended in default order. With no saved layout at all, this
 * returns the full registry in its default order with nothing hidden -- i.e.
 * identical to the dashboard's pre-customization behavior.
 */
export function normalizeDashboardLayout(saved: { order?: unknown; hidden?: unknown } | null): DashboardLayout {
  const rawOrder = Array.isArray(saved?.order) ? saved.order : [];
  const rawHidden = Array.isArray(saved?.hidden) ? saved.hidden : [];

  const savedOrder = rawOrder.filter((key): key is DashboardWidgetKey => typeof key === "string" && isDashboardWidgetKey(key));
  const missing = DASHBOARD_WIDGET_KEYS.filter((key) => !savedOrder.includes(key));
  const order = [...savedOrder, ...missing];

  const hidden = rawHidden.filter((key): key is DashboardWidgetKey => typeof key === "string" && isDashboardWidgetKey(key));

  return { order, hidden };
}
