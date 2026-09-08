"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, LayoutGrid, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetDashboardLayout, saveDashboardLayout } from "@/lib/actions/dashboard-layout";
import { DASHBOARD_WIDGET_LABELS, type DashboardWidgetKey } from "@/lib/dashboard/widgets";

export function DashboardCustomizer({
  initialOrder,
  initialHidden,
}: {
  initialOrder: DashboardWidgetKey[];
  initialHidden: DashboardWidgetKey[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [order, setOrder] = useState<DashboardWidgetKey[]>(initialOrder);
  const [hidden, setHidden] = useState<DashboardWidgetKey[]>(initialHidden);

  function moveUp(index: number) {
    if (index === 0) return;
    setOrder((current) => {
      const next = [...current];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setOrder((current) => {
      if (index >= current.length - 1) return current;
      const next = [...current];
      [next[index + 1], next[index]] = [next[index], next[index + 1]];
      return next;
    });
  }

  function toggleHidden(key: DashboardWidgetKey) {
    setHidden((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
  }

  return (
    <div className="mb-2">
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setIsOpen((open) => !open)}>
        <LayoutGrid className="h-3.5 w-3.5" />
        Customize dashboard
      </Button>

      {isOpen ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm font-medium text-slate-900">Section order and visibility</p>
          <p className="mt-1 text-xs text-slate-500">
            Use the arrows to reorder sections and the eye icon to show or hide one. Changes apply after you save.
          </p>
          <ul className="mt-3 space-y-1.5">
            {order.map((key, index) => {
              const isHidden = hidden.includes(key);
              return (
                <li
                  key={key}
                  className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
                >
                  <span className={isHidden ? "text-slate-400 line-through" : "text-slate-800"}>
                    {DASHBOARD_WIDGET_LABELS[key]}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${DASHBOARD_WIDGET_LABELS[key]} up`}
                      disabled={index === 0}
                      className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                      onClick={() => moveUp(index)}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${DASHBOARD_WIDGET_LABELS[key]} down`}
                      disabled={index === order.length - 1}
                      className="rounded p-1 text-slate-500 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-30"
                      onClick={() => moveDown(index)}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={isHidden ? `Show ${DASHBOARD_WIDGET_LABELS[key]}` : `Hide ${DASHBOARD_WIDGET_LABELS[key]}`}
                      aria-pressed={isHidden}
                      className="rounded p-1 text-slate-500 hover:bg-slate-200"
                      onClick={() => toggleHidden(key)}
                    >
                      {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <form action={resetDashboardLayout}>
              <Button type="submit" size="sm" variant="ghost" className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Reset to default
              </Button>
            </form>
            <form action={saveDashboardLayout}>
              <input type="hidden" name="order" value={JSON.stringify(order)} />
              <input type="hidden" name="hidden" value={JSON.stringify(hidden)} />
              <Button type="submit" size="sm">
                Save layout
              </Button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
