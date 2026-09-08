import { z } from "zod";
import type { PermissionKey } from "@/lib/permissions/rbac";

const filterValue = z.string().trim().max(200).optional();

const shipmentsFilterSchema = z
  .object({
    q: filterValue,
    shipmentType: filterValue,
    transportMode: filterValue,
    currentStatus: filterValue,
    assignedToId: filterValue,
    etaFrom: filterValue,
    etaTo: filterValue,
    etdFrom: filterValue,
    etdTo: filterValue,
  })
  .strict();

const quotationsFilterSchema = z
  .object({
    q: filterValue,
    status: filterValue,
    customerId: filterValue,
  })
  .strict();

const tasksFilterSchema = z
  .object({
    q: filterValue,
    status: filterValue,
    priority: filterValue,
    assignee: filterValue,
    due: filterValue,
  })
  .strict();

const customersFilterSchema = z
  .object({
    q: filterValue,
  })
  .strict();

const vendorsFilterSchema = z
  .object({
    q: filterValue,
    type: filterValue,
    status: filterValue,
  })
  .strict();

export const savedViewPageSchemas = {
  shipments: shipmentsFilterSchema,
  quotations: quotationsFilterSchema,
  tasks: tasksFilterSchema,
  customers: customersFilterSchema,
  vendors: vendorsFilterSchema,
} as const;

export type SavedViewPageKey = keyof typeof savedViewPageSchemas;

export const savedViewPageKeys = Object.keys(savedViewPageSchemas) as SavedViewPageKey[];

export function isSavedViewPageKey(value: string): value is SavedViewPageKey {
  return (savedViewPageKeys as string[]).includes(value);
}

export const savedViewPagePermissions: Record<SavedViewPageKey, PermissionKey> = {
  shipments: "shipments:view",
  quotations: "quotations:view",
  tasks: "tasks:list",
  customers: "customers:manage",
  vendors: "vendors:manage",
};

export const savedViewPagePaths: Record<SavedViewPageKey, string> = {
  shipments: "/dashboard/shipments",
  quotations: "/dashboard/quotations",
  tasks: "/dashboard/tasks",
  customers: "/dashboard/customers",
  vendors: "/dashboard/vendors",
};

export const savedViewNameSchema = z.string().trim().min(1, "Name is required.").max(80, "Name is too long.");

/**
 * Parses a raw JSON string (from the DB or a form field) into a validated,
 * page-scoped flat filter object. Rejects anything that isn't a flat object of
 * known keys/string values -- this is the boundary that keeps a saved view from
 * ever carrying an arbitrary query, nested object, or Prisma-shaped filter.
 */
export function parseSavedViewFilters(pageKey: SavedViewPageKey, raw: unknown) {
  const schema = savedViewPageSchemas[pageKey];
  if (typeof raw === "string") {
    try {
      return schema.safeParse(JSON.parse(raw));
    } catch {
      return schema.safeParse(undefined);
    }
  }
  return schema.safeParse(raw);
}
