import { prisma } from "@/lib/db/prisma";
import { hasPermission } from "@/lib/permissions/rbac";
import {
  parseSavedViewFilters,
  savedViewPagePermissions,
  type SavedViewPageKey,
} from "@/lib/validators/saved-views";

export type SavedViewSummary = {
  id: string;
  name: string;
  isDefault: boolean;
  filters: Record<string, string | undefined>;
};

type ScopedUser = {
  id: string;
  companyId?: string | null;
  permissions?: string[];
};

/** Re-validates each stored filterJson against the page's current schema on
 * every read, so a saved view can never hand back more than its allowlisted
 * filter keys even if the schema narrowed after the row was written. */
export async function getSavedViewsForPage(
  user: ScopedUser,
  pageKey: SavedViewPageKey,
): Promise<SavedViewSummary[]> {
  if (!user.companyId || !hasPermission(user, savedViewPagePermissions[pageKey])) return [];

  const rows = await prisma.savedview.findMany({
    where: { companyId: user.companyId, userId: user.id, pageKey, deletedAt: null },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, isDefault: true, filterJson: true },
  });

  return rows.flatMap((row) => {
    const parsed = parseSavedViewFilters(pageKey, row.filterJson);
    if (!parsed.success) return [];
    return [{ id: row.id, name: row.name, isDefault: row.isDefault, filters: parsed.data }];
  });
}

export function savedViewQueryString(filters: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) query.set(key, value);
  }
  return query.toString();
}
