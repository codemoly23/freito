// Client-safe: no Prisma/server import here. lib/approvals/roles.ts re-exports
// these for server-side callers; components (e.g. create-policy-form.tsx)
// must import from this file directly so bundling this constant into a
// client chunk never drags in the Prisma/mariadb driver behind it.
export const APPROVER_ROLE_CODES = [
  "COMPANY_ADMIN",
  "OPERATIONS_MANAGER",
  "DOCUMENTATION_OFFICER",
  "ACCOUNTS_OFFICER",
  "SALES_EXECUTIVE",
] as const;

export type ApproverRoleCode = (typeof APPROVER_ROLE_CODES)[number];

export function isApproverRoleCode(value: string): value is ApproverRoleCode {
  return (APPROVER_ROLE_CODES as readonly string[]).includes(value);
}
