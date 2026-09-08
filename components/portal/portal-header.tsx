"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { KeyRound, ShieldAlert } from "lucide-react";
import { ChangePasswordModal } from "@/components/portal/change-password-modal";

export function PortalHeader({
  companySlug,
  companyName,
  customerName,
  clientCode,
  hasLogo,
  mustChangePassword,
}: {
  companySlug: string;
  companyName: string;
  customerName: string;
  clientCode?: string;
  hasLogo?: boolean;
  mustChangePassword?: boolean;
}) {
  return (
    <header className="border-b border-slate-800 bg-slate-950 px-5 py-5 text-white">
      {mustChangePassword ? (
        <ChangePasswordModal
          companySlug={companySlug}
          forceMandatory={true}
        />
      ) : null}

      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {hasLogo ? (
            <Image
              alt={`${companyName} logo`}
              className="h-12 w-auto rounded bg-white object-contain p-1"
              height={48}
              src={`/api/portal/${companySlug}/branding/logo`}
              unoptimized
              width={144}
            />
          ) : null}
          <div>
            <p className="text-sm text-cyan-300">Client Portal</p>
            <h1 className="text-2xl font-semibold">{companyName}</h1>
            <p className="text-sm text-slate-300">
              {customerName}
              {clientCode ? ` · ${clientCode}` : ""}
            </p>
          </div>
        </div>

        <nav className="flex flex-wrap gap-4 text-sm items-center">
          <Link href={`/portal/${companySlug}`} className="hover:text-cyan-300 transition">
            Dashboard
          </Link>
          <Link href={`/portal/${companySlug}/requests`} className="hover:text-cyan-300 transition">
            Requests
          </Link>
          <Link href={`/portal/${companySlug}/shipments`} className="hover:text-cyan-300 transition">
            Shipments
          </Link>
          <Link href={`/portal/${companySlug}/documents`} className="hover:text-cyan-300 transition">
            Documents
          </Link>
          <Link href={`/portal/${companySlug}/invoices`} className="hover:text-cyan-300 transition">
            Invoices
          </Link>
          <Link href={`/portal/${companySlug}/notifications`} className="hover:text-cyan-300 transition">
            Notifications
          </Link>

          <ChangePasswordModal
            companySlug={companySlug}
            triggerLabel="Password"
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-cyan-300 hover:bg-slate-900 border-0 text-sm font-normal px-2"
          />

          <button
            onClick={() => signOut({ callbackUrl: `/portal/${companySlug}/login` })}
            className="text-slate-300 hover:text-red-400 transition cursor-pointer font-medium border-0 bg-transparent p-0"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}

