"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ClipboardList, Ship, ReceiptText, BarChart3, Landmark, Zap, X } from "lucide-react";

interface FloatingQuickActionsProps {
  financial: boolean;
}

export function FloatingQuickActions({ financial }: FloatingQuickActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const actions = [
    { label: "New Shipment Request", href: "/dashboard/shipment-requests/new", icon: ClipboardList, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40" },
    { label: "New Shipment Job", href: "/dashboard/shipments/new", icon: Ship, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40" },
    { label: "New Quotation", href: "/dashboard/quotations/new", icon: ReceiptText, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40" },
    { label: "View Report Center", href: "/dashboard/reports", icon: BarChart3, color: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40" },
    ...(financial ? [{ label: "View Financial Reports", href: "/dashboard/reports/financial", icon: Landmark, color: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40" }] : []),
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end" ref={menuRef}>
      {/* Menu Options */}
      <div
        className={`mb-3 flex flex-col gap-2 transition-all duration-300 origin-bottom-right ${
          isOpen
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 p-3 shadow-xl backdrop-blur-md min-w-[240px]">
          <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Quick Actions</p>
          <div className="space-y-1">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${action.color}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="font-medium">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 ${
          isOpen
            ? "bg-[#0f172a] dark:bg-slate-800 shadow-slate-900/30 rotate-90 text-[#ffffff]"
            : "bg-cyan-600 shadow-cyan-600/30 hover:bg-cyan-700 text-[#ffffff]"
        }`}
        aria-label="Toggle Quick Actions"
      >
        {isOpen ? <X className="h-6 w-6" /> : <Zap className="h-6 w-6 animate-pulse" />}
      </button>
    </div>
  );
}
