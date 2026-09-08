"use client";

import { Bell, Menu } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type DashboardHeaderProps = {
  user: {
    name?: string | null;
    email?: string | null;
    companyName?: string | null;
    roles: string[];
  };
  panelLabel?: string;
  signOutCallbackUrl?: string;
  notificationsHref?: string;
  unreadNotificationCount?: number;
  showSearch?: boolean;
  canUseAiSearch?: boolean;
};

function initials(name?: string | null) {
  if (!name) return "FC";
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function DashboardHeader({
  user,
  panelLabel,
  signOutCallbackUrl = "/login",
  notificationsHref,
  unreadNotificationCount = 0,
  showSearch = false,
  canUseAiSearch = false,
}: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden shrink-0 text-slate-500 -ml-1 mr-1"
        onClick={() => window.dispatchEvent(new Event("toggle-mobile-sidebar"))}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950">
          {panelLabel ?? user.companyName ?? "Platform Administration"}
        </p>
        <p className="truncate text-xs text-slate-500">
          {user.roles.join(", ") || "No role assigned"}
        </p>
      </div>

      {showSearch ? <GlobalSearch canUseAi={canUseAiSearch} /> : null}

      {notificationsHref ? (
        <Button asChild variant="outline" size="icon">
          <Link href={notificationsHref} aria-label={`Notifications${unreadNotificationCount ? ` (${unreadNotificationCount} unread)` : ""}`} className="relative">
            <Bell className="h-4 w-4" />
            {unreadNotificationCount ? <span className="absolute -right-1.5 -top-1.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] text-white">{Math.min(unreadNotificationCount, 99)}</span> : null}
          </Link>
        </Button>
      ) : null}

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-slate-950">
            <Avatar>
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium text-slate-950">{user.name}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              signOut({ callbackUrl: signOutCallbackUrl });
            }}
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
