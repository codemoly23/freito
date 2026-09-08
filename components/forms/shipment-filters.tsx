"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Search, X } from "lucide-react";

interface ShipmentFiltersProps {
  initialParams: {
    q?: string;
    shipmentType?: string;
    transportMode?: string;
    currentStatus?: string;
    assignedToId?: string;
    etaFrom?: string;
    etaTo?: string;
    etdFrom?: string;
    etdTo?: string;
  };
  assignedUsers: {
    id: string;
    name: string;
  }[];
}

export function ShipmentFilters({ initialParams, assignedUsers }: ShipmentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Check if any advanced filter is currently active
  const hasActiveFilters = !!(
    initialParams.shipmentType ||
    initialParams.transportMode ||
    initialParams.currentStatus ||
    initialParams.assignedToId ||
    initialParams.etaFrom ||
    initialParams.etaTo ||
    initialParams.etdFrom ||
    initialParams.etdTo
  );

  const [isOpen, setIsOpen] = useState(hasActiveFilters);

  const [q, setQ] = useState(initialParams.q ?? "");
  const [shipmentType, setShipmentType] = useState(initialParams.shipmentType ?? "");
  const [transportMode, setTransportMode] = useState(initialParams.transportMode ?? "");
  const [currentStatus, setCurrentStatus] = useState(initialParams.currentStatus ?? "");
  const [assignedToId, setAssignedToId] = useState(initialParams.assignedToId ?? "");
  const [etaFrom, setEtaFrom] = useState(initialParams.etaFrom ?? "");
  const [etaTo, setEtaTo] = useState(initialParams.etaTo ?? "");
  const [etdFrom, setEtdFrom] = useState(initialParams.etdFrom ?? "");
  const [etdTo, setEtdTo] = useState(initialParams.etdTo ?? "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const queryParams = new URLSearchParams();
    if (q) queryParams.set("q", q);
    if (shipmentType) queryParams.set("shipmentType", shipmentType);
    if (transportMode) queryParams.set("transportMode", transportMode);
    if (currentStatus) queryParams.set("currentStatus", currentStatus);
    if (assignedToId) queryParams.set("assignedToId", assignedToId);
    if (etaFrom) queryParams.set("etaFrom", etaFrom);
    if (etaTo) queryParams.set("etaTo", etaTo);
    if (etdFrom) queryParams.set("etdFrom", etdFrom);
    if (etdTo) queryParams.set("etdTo", etdTo);

    router.push(`${pathname}?${queryParams.toString()}`);
  };

  const handleClear = () => {
    setQ("");
    setShipmentType("");
    setTransportMode("");
    setCurrentStatus("");
    setAssignedToId("");
    setEtaFrom("");
    setEtaTo("");
    setEtdFrom("");
    setEtdTo("");
    router.push(pathname);
  };

  return (
    <form onSubmit={handleSearch} className="space-y-3">
      {/* Main Row: Search Bar & Filter Toggle Button */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search job, BL/AWB, customer, container..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(!isOpen)}
            className={`gap-2 ${hasActiveFilters ? "border-cyan-200 bg-cyan-50/50 text-cyan-700 hover:bg-cyan-50" : ""}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 rounded-full bg-cyan-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                Active
              </span>
            )}
          </Button>
          <Button type="submit">Search</Button>
          {(q || hasActiveFilters) && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="gap-1.5 text-slate-500 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Expandable Advanced Filters Panel */}
      {isOpen && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Shipment Type</label>
              <select
                value={shipmentType}
                onChange={(e) => setShipmentType(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="IMPORT">Import</option>
                <option value="EXPORT">Export</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Transport Mode</label>
              <select
                value={transportMode}
                onChange={(e) => setTransportMode(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="">All Modes</option>
                <option value="SEA">Sea</option>
                <option value="AIR">Air</option>
                <option value="LAND">Land</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Current Status</label>
              <Input
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value)}
                placeholder="Status (e.g., Arrived)"
                className="h-9 bg-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Assigned To</label>
              <select
                value={assignedToId}
                onChange={(e) => setAssignedToId(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="">All Assignees</option>
                {assignedUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">ETA From</label>
              <Input
                type="date"
                value={etaFrom}
                onChange={(e) => setEtaFrom(e.target.value)}
                className="h-9 bg-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">ETA To</label>
              <Input
                type="date"
                value={etaTo}
                onChange={(e) => setEtaTo(e.target.value)}
                className="h-9 bg-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">ETD From</label>
              <Input
                type="date"
                value={etdFrom}
                onChange={(e) => setEtdFrom(e.target.value)}
                className="h-9 bg-white"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">ETD To</label>
              <Input
                type="date"
                value={etdTo}
                onChange={(e) => setEtdTo(e.target.value)}
                className="h-9 bg-white"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={handleClear}>
              Reset
            </Button>
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
