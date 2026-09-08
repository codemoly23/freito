import type { role_code as RoleCode, user_scope as UserScope } from "@/lib/generated/prisma/enums";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      companyId: string | null;
      companyName: string | null;
      customerId: string | null;
      clientPortalAccountId: string | null;
      companySlug: string | null;
      displayClientCode: string | null;
      scope: UserScope;
      roles: RoleCode[];
      permissions: string[];
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }

  interface User {
    companyId: string | null;
    companyName: string | null;
    customerId: string | null;
    clientPortalAccountId: string | null;
    companySlug: string | null;
    displayClientCode: string | null;
    scope: UserScope;
    roles: RoleCode[];
    permissions: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string | null;
    companyName: string | null;
    customerId: string | null;
    clientPortalAccountId: string | null;
    companySlug: string | null;
    displayClientCode: string | null;
    scope: UserScope;
    roles: RoleCode[];
    permissions: string[];
  }
}
