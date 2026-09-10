"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState, useEffect, useRef } from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  Cable,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  ClipboardList,
  FileText,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Mail,
  ReceiptText,
  Repeat,
  Route,
  Settings,
  ShieldCheck,
  Ship,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  WalletCards,
  Workflow,
} from "lucide-react";
import type { PermissionKey } from "@/lib/permissions/rbac";
import { cn } from "@/lib/utils";
import type { ModuleKey } from "@/lib/access/company-access";

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: PermissionKey | PermissionKey[];
  moduleKey?: ModuleKey;
};

type NavigationGroup = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavigationItem[];
};

const navigationGroups: NavigationGroup[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { name: "Control Tower", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    icon: Workflow,
    items: [
      { name: "Shipment Requests", href: "/dashboard/shipment-requests", icon: ClipboardList, permission: "shipmentRequests:view", moduleKey: "SHIPMENTS" },
      { name: "Shipments / Job Files", href: "/dashboard/shipments", icon: Ship, permission: "shipments:view", moduleKey: "SHIPMENTS" },
      { name: "Workflow / Delivery", href: "/dashboard/tasks", icon: Workflow, permission: "tasks:list", moduleKey: "TASKS" },
      { name: "Recurring Tasks", href: "/dashboard/task-recurrences", icon: Repeat, permission: "tasks:list", moduleKey: "TASKS" },
      { name: "Carrier Queries", href: "/dashboard/carrier-queries", icon: Route, permission: "carrierQueries:list", moduleKey: "SHIPMENT_OPERATIONS" },
    ],
  },
  {
    label: "Sales",
    icon: TrendingUp,
    items: [
      { name: "Quotations", href: "/dashboard/quotations", icon: ReceiptText, permission: "quotations:view", moduleKey: "QUOTATIONS" },
      { name: "Customers", href: "/dashboard/customers", icon: Users },
    ],
  },
  {
    label: "Documents",
    icon: FileText,
    items: [
      { name: "Document Center", href: "/dashboard/reports/documents", icon: FileText, moduleKey: "DOCUMENTS" },
    ],
  },
  {
    label: "Finance",
    icon: WalletCards,
    items: [
      { name: "Invoices", href: "/dashboard/invoices", icon: ReceiptText, permission: "invoices:view", moduleKey: "BILLING" },
      { name: "Vendor Bills", href: "/dashboard/vendor-bills", icon: WalletCards, permission: "vendorBills:view", moduleKey: "BILLING" },
      { name: "Payments", href: "/dashboard/payments", icon: WalletCards, permission: "payments:view", moduleKey: "BILLING" },
      { name: "Approvals", href: "/dashboard/approvals", icon: CheckSquare, permission: ["vendorBills:approve", "payments:approve"], moduleKey: "BILLING" },
      { name: "Receivables", href: "/dashboard/receivables", icon: Landmark, permission: "receivables:view", moduleKey: "BILLING" },
      { name: "Payables", href: "/dashboard/payables", icon: Landmark, permission: "payables:view", moduleKey: "BILLING" },
    ],
  },
  {
    label: "Accounting",
    icon: BookOpen,
    items: [
      { name: "Ledger Accounts", href: "/dashboard/accounting/ledgers", icon: BookOpen, permission: "ledgers:view", moduleKey: "BILLING" },
      { name: "Opening Balances", href: "/dashboard/accounting/opening-balances", icon: BookOpen, permission: "accounts:manage", moduleKey: "BILLING" },
      { name: "Journal Vouchers", href: "/dashboard/accounting/journal-vouchers", icon: BookOpen, permission: "accounts:manage", moduleKey: "BILLING" },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    items: [
      { name: "Report Center", href: "/dashboard/reports", icon: BarChart3, permission: "reports:view", moduleKey: "REPORTS" },
      { name: "AI Exception Radar", href: "/dashboard/exceptions", icon: Sparkles, permission: "reports:view", moduleKey: "REPORTS" },
    ],
  },
  {
    label: "Admin / Settings",
    icon: Settings,
    items: [
      { name: "Branches", href: "/dashboard/branches", icon: Building2, permission: "branches:view" },
      { name: "Users", href: "/dashboard/users", icon: Users },
      { name: "Roles", href: "/dashboard/roles", icon: Settings },
      { name: "Vendors", href: "/dashboard/vendors", icon: Building2 },
      { name: "Data Import", href: "/dashboard/imports", icon: Upload, permission: "imports:csv" },
      { name: "Company Settings", href: "/dashboard/settings/branding", icon: Settings, permission: "branding:manage" },
      { name: "Document Templates", href: "/dashboard/settings/document-templates", icon: FileText, permission: "documentTemplates:manage" },
      { name: "Approval Policies", href: "/dashboard/settings/approval-policies", icon: ShieldCheck, permission: "approvalPolicies:manage" },
      { name: "Notification Templates", href: "/dashboard/notification-templates", icon: Mail, permission: "notificationTemplates:view" },
      { name: "Delivery Outbox", href: "/dashboard/notification-deliveries", icon: ListChecks, permission: "notificationDeliveries:view" },
      { name: "Communication Accounts", href: "/dashboard/communication-accounts", icon: Cable, permission: "communicationAccounts:view" },
      { name: "AI Settings", href: "/dashboard/settings/ai", icon: Sparkles, permission: "ai:configure" },
    ],
  },
];

export function AppSidebar({
  user,
  enabledModules,
}: {
  user: { permissions?: string[]; roles?: string[] };
  enabledModules: string[];
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const isFirstPathnameRun = useRef(true);

  const isActive = (item: NavigationItem) =>
    item.href === "/dashboard"
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  const activeSectionLabel =
    navigationGroups.find((group) => group.items.some(isActive))?.label ?? null;

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") {
      setIsCollapsed(true);
    }

    // First load: resume the last section the user had open, falling back to
    // whichever section contains the current page (e.g. Dashboard on /dashboard).
    const storedSection = localStorage.getItem("sidebar-open-section");
    setOpenSection(storedSection ?? activeSectionLabel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Skip the very first run — the mount effect above already resolved the
    // initial open section (which may be a remembered one, not the active route).
    if (isFirstPathnameRun.current) {
      isFirstPathnameRun.current = false;
      return;
    }
    if (activeSectionLabel) {
      setOpenSection(activeSectionLabel);
      localStorage.setItem("sidebar-open-section", activeSectionLabel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const handler = () => setIsMobileOpen((prev) => !prev);
    window.addEventListener("toggle-mobile-sidebar", handler);
    return () => window.removeEventListener("toggle-mobile-sidebar", handler);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleCollapse = () => {
    const nextValue = !isCollapsed;
    setIsCollapsed(nextValue);
    localStorage.setItem("sidebar-collapsed", String(nextValue));
  };

  const toggleSection = (label: string) => {
    setOpenSection((current) => {
      const next = current === label ? null : label;
      if (next) {
        localStorage.setItem("sidebar-open-section", next);
      } else {
        localStorage.removeItem("sidebar-open-section");
      }
      return next;
    });
  };

  const enabledModuleSet = new Set(enabledModules);

  const isItemVisible = (item: NavigationItem) =>
    (!item.permission ||
      (Array.isArray(item.permission)
        ? item.permission.some((permission) => user.permissions?.includes(permission))
        : user.permissions?.includes(item.permission))) &&
    (!item.moduleKey || enabledModuleSet.has(item.moduleKey));

  const visibleGroups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(isItemVisible),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "sticky top-0 h-screen hidden shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#090d16] text-slate-900 dark:text-white lg:block transition-all duration-300 ease-in-out z-30",
          isCollapsed ? "w-20" : "w-72",
          isMobileOpen && "fixed inset-y-0 left-0 z-50 block w-72 shadow-xl animate-in slide-in-from-left duration-250 bg-white dark:bg-[#090d16]"
        )}
      >
      <div
        className={cn(
          "flex h-16 items-center border-b border-slate-200 dark:border-slate-800 transition-all duration-300",
          isCollapsed ? "justify-center px-2" : "justify-between px-5"
        )}
      >
        {!isCollapsed ? (
          <div className="relative h-7 w-28 dark:filter dark:brightness-0 dark:invert">
            <Image
              src="/images/freito-logo.svg"
              alt="FreightFast"
              fill
              priority
              className="object-contain object-left"
            />
          </div>
        ) : (
          <div className="relative h-8 w-8">
            <Image
              src="/icon.png"
              alt="FreightFast"
              fill
              priority
              className="object-contain"
            />
          </div>
        )}

        {/* Advanced Cargo Operations Integration Schematic Animation (Refined Layout) */}
        {!isCollapsed && (
          <div className="flex items-center text-slate-300 dark:text-[#94a3b8] pr-1 select-none">
            <svg width="120" height="50" className="hover:text-cyan-500 transition-colors cursor-help">
              <title>FreightFast Integrated Workflow (Converging Ops → Entering FreightFast)</title>
              
              {/* Input Lines (Right side) converging to Hub at X=35 */}
              {/* Top: Air */}
              <path d="M 118,8 C 80,8 60,16 35,26" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.8 1.8" className="opacity-35" />
              {/* Middle: Road */}
              <path d="M 118,26 L 35,26" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.8 1.8" className="opacity-35" />
              {/* Bottom: Ocean */}
              <path d="M 118,44 C 80,44 60,36 35,26" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1.8 1.8" className="opacity-35" />
              
              {/* Output Line (going left to connect to the FreightFast logo) */}
              <path d="M 35,26 L 2,26" fill="none" stroke="#17B8C4" strokeWidth="1.2" className="opacity-70" />
              
              {/* Converging Inputs Particles (moving right to left) */}
              {/* Plane (Top) */}
              <g>
                <path d="M 3,-1.5 L -3,0 L 3,1.5 L 2,0 Z" fill="#17B8C4" />
                <animateMotion dur="3s" repeatCount="indefinite" path="M 118,8 C 80,8 60,16 35,26" rotate="auto" />
              </g>
              
              {/* Truck (Middle) */}
              <g>
                {/* Cabin facing left, bed on right */}
                <path d="M -0.5,-1.8 H 3.5 V 1.2 H -0.5 Z M -3.5,-0.8 H -0.5 V 1.2 H -3.5 Z" fill="#17B8C4" />
                <circle cx="-2" cy="2.2" r="0.8" fill="#17B8C4" />
                <circle cx="1.5" cy="2.2" r="0.8" fill="#17B8C4" />
                <animateMotion dur="2.5s" repeatCount="indefinite" path="M 118,26 L 35,26" />
              </g>
              
              {/* Ship (Bottom) */}
              <g>
                <path d="M 3,0.5 L 2,-1.5 L -2,-1.5 L -3,0.5 Z" fill="#17B8C4" />
                <rect x="-1" y="-3" width="2" height="1.8" fill="#17B8C4" />
                <animateMotion dur="3.8s" repeatCount="indefinite" path="M 118,44 C 80,44 60,36 35,26" rotate="auto" />
              </g>
              
              {/* Central Hub Node (FreightFast Core Engine) */}
              <g transform="translate(35, 26)">
                <circle cx="0" cy="0" r="5" fill="none" stroke="#17B8C4" strokeWidth="1">
                  <animate attributeName="r" values="4;9;4" dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="1;0.1;1" dur="1.8s" repeatCount="indefinite" />
                </circle>
                <circle cx="0" cy="0" r="3" fill="#17B8C4" />
              </g>
              
              {/* Outgoing Output Result (The Optimized Solution going into the Logo) */}
              {/* Golden Cargo Box representing delivered value */}
              <g>
                <rect x="-2.5" y="-2.5" width="5" height="5" fill="#F2A93B" rx="1" />
                <animateMotion dur="1.6s" repeatCount="indefinite" path="M 35,26 L 2,26" />
                <animate attributeName="opacity" values="0.1;1;0.1" dur="1.6s" repeatCount="indefinite" />
              </g>
            </svg>
          </div>
        )}

        <button
          onClick={toggleCollapse}
          className={cn(
            "rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors",
            isCollapsed && "ml-1"
          )}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="overflow-y-auto custom-scrollbar px-3 py-4" style={{ maxHeight: "calc(100vh - 4rem)" }}>
        {visibleGroups.map((group) => {
          const isOpen = isCollapsed || openSection === group.label;
          const renderItems = () =>
            group.items.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "flex items-center text-sm font-medium text-slate-600 dark:text-[#cbd5e1] transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-950 dark:hover:text-[#ffffff]",
                  isCollapsed ? "justify-center p-2.5 mx-auto w-10 h-10 rounded-md" : "gap-3 rounded-md px-3 py-2.5",
                  isActive(item) && (
                    isCollapsed
                      ? "bg-slate-950 text-white hover:bg-slate-900 dark:bg-cyan-600 dark:text-[#ffffff] dark:hover:bg-cyan-500"
                      : "bg-slate-950 text-white hover:bg-slate-900 hover:text-white dark:bg-gradient-to-r dark:from-cyan-600 dark:via-blue-600 dark:to-indigo-600 dark:text-[#ffffff] dark:hover:from-cyan-600 dark:hover:to-indigo-600 dark:shadow-md dark:shadow-cyan-950/20"
                  )
                )}
              >
                <item.icon className={cn("shrink-0 transition-all duration-200", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />
                {!isCollapsed && <span className="flex-1 truncate">{item.name}</span>}
              </Link>
            ));

          return (
            <div key={group.label} className="mb-2">
              {!isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleSection(group.label)}
                  aria-expanded={isOpen}
                  className="mb-1 flex w-full items-center justify-between rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:text-slate-900 dark:text-cyan-500/80 dark:hover:text-cyan-400"
                >
                  <span className="flex items-center gap-2">
                    <group.icon className="h-3.5 w-3.5 shrink-0" />
                    {group.label}
                  </span>
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-90"
                    )}
                  />
                </button>
              ) : (
                <div className="mx-3 my-3 border-b border-slate-100 dark:border-slate-800 transition-all duration-300" />
              )}

              {isCollapsed ? (
                <div className="space-y-0.5">{renderItems()}</div>
              ) : (
                <div
                  className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <div className="space-y-0.5 pb-1">{renderItems()}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
    </>
  );
}
