"use client";

import { useEffect, useState, type ReactNode } from "react";

export type ShipmentDetailTab = {
  id: string;
  label: string;
};

type ShipmentDetailTabsProps = {
  tabs: ShipmentDetailTab[];
  children: ReactNode;
};

export function ShipmentDetailTabs({ tabs, children }: ShipmentDetailTabsProps) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "overview");

  useEffect(() => {
    const hashTab = window.location.hash.replace("#", "");
    if (hashTab && tabs.some((tab) => tab.id === hashTab)) {
      const frame = window.requestAnimationFrame(() => setActiveTab(hashTab));
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [tabs]);

  const activeLabel = tabs.find((tab) => tab.id === activeTab)?.label ?? "Overview";

  return (
    <div className="space-y-6">
      <div
        aria-label="Shipment job file sections"
        className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-2 text-sm"
        role="tablist"
      >
        {tabs.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              aria-controls={`shipment-tab-panel-${tab.id}`}
              aria-selected={selected}
              className={
                selected
                  ? "rounded-md border border-slate-300 bg-slate-950 px-3 py-2 font-medium text-white shadow-sm"
                  : "rounded-md border border-transparent px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              }
              id={`shipment-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        aria-labelledby={`shipment-tab-${activeTab}`}
        data-active-tab={activeTab}
        data-shipment-tab-panels
        id={`shipment-tab-panel-${activeTab}`}
        role="tabpanel"
      >
        <style>{`
          [data-shipment-tab-panels] #overview,
          [data-shipment-tab-panels] #workflow,
          [data-shipment-tab-panels] #commercial,
          [data-shipment-tab-panels] #operations,
          [data-shipment-tab-panels] #documents,
          [data-shipment-tab-panels] #freight-documents,
          [data-shipment-tab-panels] #finance,
          [data-shipment-tab-panels] #client-portal,
          [data-shipment-tab-panels] #tasks,
          [data-shipment-tab-panels] #timeline,
          [data-shipment-tab-panels] #audit,
          [data-shipment-tab-panels] #ai-copilot {
            display: none;
          }

          [data-active-tab="overview"] #overview,
          [data-active-tab="commercial"] #commercial {
            display: grid;
          }

          [data-active-tab="workflow"] #workflow,
          [data-active-tab="operations"] #operations,
          [data-active-tab="documents"] #documents,
          [data-active-tab="freight-documents"] #freight-documents,
          [data-active-tab="finance"] #finance,
          [data-active-tab="client-portal"] #client-portal,
          [data-active-tab="tasks"] #tasks,
          [data-active-tab="timeline"] #timeline,
          [data-active-tab="audit"] #audit,
          [data-active-tab="ai-copilot"] #ai-copilot {
            display: block;
          }
        `}</style>
        <span className="sr-only">Active section: {activeLabel}</span>
        {children}
      </div>
    </div>
  );
}
