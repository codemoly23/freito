"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState, useEffect } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DollarSign,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavigationItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
};

const navigation: NavigationItem[] = [
  { name: "Platform Dashboard", href: "/platform", icon: LayoutDashboard },
  { name: "Companies", href: "/platform/companies", icon: Building2, permission: "platform:companies:view" },
  { name: "Exchange Rates", href: "/platform/exchange-rates", icon: DollarSign, permission: "platform:companies:view" },
  { name: "Subscriptions / Licenses", href: "/platform/subscriptions", icon: KeyRound, permission: "platform:subscriptions:view" },
  { name: "Module Access", href: "/platform/modules", icon: PackageCheck, permission: "platform:modules:update" },
  { name: "Platform Audit", href: "/platform/audit", icon: ClipboardList, permission: "platform:audit:view" },
  { name: "Support", href: "/platform/support", icon: LifeBuoy, permission: "platform:support:access" },
];

export function PlatformSidebar({
  user,
}: {
  user: { permissions?: string[]; roles?: string[] };
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("platform-sidebar-collapsed");
    if (stored === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of persisted sidebar state from localStorage.
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    const nextValue = !isCollapsed;
    setIsCollapsed(nextValue);
    localStorage.setItem("platform-sidebar-collapsed", String(nextValue));
  };

  const visibleNavigation = navigation.filter(
    (item) => !item.permission || user.permissions?.includes(item.permission),
  );

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-[#1e293b] bg-[#020617] text-[#ffffff] lg:block transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center border-b border-[#ffffff]/10 transition-all duration-300",
          isCollapsed ? "justify-center px-2" : "justify-between px-5"
        )}
      >
        {!isCollapsed ? (
          <div className="relative h-7 w-28 filter brightness-0 invert">
            <Image
              src="/images/freightfast-logo.svg"
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

        {/* Advanced Cargo Operations Integration Schematic Animation (Refined Layout) (Dark theme) */}
        {!isCollapsed && (
          <div className="flex items-center text-[#ffffff]/10 pr-1 select-none">
            <svg width="120" height="50" className="hover:text-cyan-400 transition-colors cursor-help">
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
            "rounded-md p-1.5 hover:bg-[#ffffff]/10 text-[#cbd5e1] transition-colors",
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

      <nav className="space-y-1 px-3 py-4">
        {visibleNavigation.map((item) => {
          const isActive =
            item.href === "/platform"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center text-sm font-medium text-[#cbd5e1] transition-all duration-200 hover:bg-[#ffffff]/10 hover:text-[#ffffff]",
                isCollapsed ? "justify-center p-2.5 mx-auto w-10 h-10 rounded-md" : "gap-3 rounded-md px-3 py-2.5",
                isActive && (
                  isCollapsed
                    ? "bg-cyan-600 text-[#ffffff] hover:bg-cyan-500"
                    : "bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 text-[#ffffff] hover:from-cyan-600 hover:to-indigo-600 shadow-md shadow-cyan-950/20"
                )
              )}
            >
              <item.icon className={cn("shrink-0 transition-all duration-200", isCollapsed ? "h-5 w-5" : "h-4 w-4")} />
              {!isCollapsed && <span className="flex-1 truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
