/**
 * Permission keys that exist but are intentionally excluded from
 * `companySafePermissions` (lib/actions/roles.ts) — they can only be
 * granted by a platform-level action or a direct seed, never self-service
 * by a company admin through the Roles page. `companies:switch`
 * (cross-company audit access) is the first of these.
 *
 * Lives in its own plain module (not lib/actions/roles.ts) because a
 * "use server" file may only export async functions — a plain constant
 * export there breaks the Next.js build.
 */
export const SEED_ONLY_PERMISSION_KEYS = ["companies:switch"];
