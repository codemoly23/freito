"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { switchActiveCompany } from "@/lib/actions/company-switch";

export function CompanySwitcher({
  companies,
  activeCompanyId,
}: {
  companies: { id: string; name: string }[];
  activeCompanyId: string | null;
}) {
  const { update } = useSession();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (companies.length < 2) return null;

  function handleChange(companyId: string) {
    setError(null);
    startTransition(async () => {
      const result = await switchActiveCompany(companyId);
      if (!result.ok) {
        setError(result.message ?? "Could not switch company.");
        return;
      }
      await update({ activeCompanyId: companyId });
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
      <select
        value={activeCompanyId ?? ""}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 max-w-[180px] rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 disabled:opacity-60"
        aria-label="Switch company (audit view)"
        title="Switch company (audit view — reports only)"
      >
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
