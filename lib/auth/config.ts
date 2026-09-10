import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { clientPortalLoginSchema, loginSchema } from "@/lib/validators/auth";

async function getAccessProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      companyId: true,
      customerId: true,
      scope: true,
      userrole: {
        select: {
          role: {
            select: {
              code: true,
              rolepermission: {
                select: {
                  permission: {
                    select: {
                      key: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  const roles = user?.userrole.map((ur) => ur.role.code) ?? [];
  const permissions = new Set<string>();

  user?.userrole.forEach((ur) => {
    ur.role.rolepermission.forEach((rp) => {
      permissions.add(rp.permission.key);
    });
  });

  return {
    companyId: user?.companyId ?? null,
    scope: user?.scope ?? "COMPANY",
    roles,
    permissions: Array.from(permissions),
    customerId: user?.customerId ?? null,
    clientPortalAccountId: null,
    companySlug: null,
    displayClientCode: null,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        loginScope: { label: "Login scope", type: "text" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        let user;

        try {
          user = await prisma.user.findUnique({
            where: { email: parsed.data.email.toLowerCase() },
            include: {
              company: true,
              userrole: {
                include: {
                  role: {
                    include: {
                      rolepermission: {
                        include: {
                          permission: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          });
        } catch (error) {
          console.error("Unable to load user during credentials sign in", error);
          throw new Error("DATABASE_UNAVAILABLE");
        }

        if (!user || user.status !== "ACTIVE" || !user.passwordHash) {
          return null;
        }

        const isValidPassword = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );

        if (!isValidPassword) return null;

        const loginScope = String(credentials?.loginScope ?? "COMPANY");
        if (!["PLATFORM", "COMPANY", "CLIENT"].includes(loginScope)) {
          return null;
        }

        if (user.scope !== loginScope) {
          throw new Error("WRONG_LOGIN_PORTAL");
        }

        const roles = user.userrole.map((ur) => ur.role.code);
        const permissions = Array.from(
          new Set(
            user.userrole.flatMap((ur) =>
              ur.role.rolepermission.map(
                (rp) => rp.permission.key,
              ),
            ),
          ),
        );

        try {
          await prisma.auditlog.create({
            data: {
              id: crypto.randomUUID(),
              companyId: user.companyId,
              actorId: user.id,
              action: "auth.login",
              entityType: "User",
              entityId: user.id,
            },
          });
        } catch (error) {
          console.error("Unable to write login audit log", error);
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          companyId: user.companyId,
          companyName: user.company?.name ?? null,
          scope: user.scope,
          roles,
          permissions,
          customerId: user.customerId,
          clientPortalAccountId: null,
          companySlug: null,
          displayClientCode: null,
        };
      },
    }),
    CredentialsProvider({
      id: "client-portal",
      name: "Client Portal",
      credentials: {
        companySlug: { label: "Company portal", type: "text" },
        clientCode: { label: "Client ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = clientPortalLoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const company = await prisma.company.findFirst({
          where: {
            portalSlug: parsed.data.companySlug,
            portalEnabled: true,
            status: "ACTIVE",
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            portalSlug: true,
            portalDisplayName: true,
            subscriptionStatus: true,
            planType: true,
            trialEndsAt: true,
            companymoduleaccess: {
              where: { moduleKey: "CLIENT_PORTAL", isEnabled: true },
              select: { id: true },
            },
          },
        });

        const trialAllowed =
          company?.subscriptionStatus === "TRIAL" &&
          (!company.trialEndsAt || company.trialEndsAt >= new Date());
        const companyAllowed =
          company &&
          company.companymoduleaccess.length > 0 &&
          (company.subscriptionStatus === "ACTIVE" || trialAllowed);

        if (!companyAllowed) return null;

        const normalizedCode = parsed.data.clientCode.trim().toUpperCase();
        const account = await prisma.clientportalaccount.findFirst({
          where: {
            companyId: company.id,
            deletedAt: null,
            status: { in: ["ACTIVE", "INVITED"] },
            OR: [
              { clientCode: normalizedCode },
              { displayClientCode: normalizedCode },
            ],
          },
          include: { customer: { select: { name: true } } },
        });

        if (
          !account ||
          !(await verifyPassword(parsed.data.password, account.passwordHash))
        ) {
          return null;
        }

        await prisma.$transaction([
          prisma.clientportalaccount.update({
            where: { id: account.id },
            data: { lastLoginAt: new Date() },
          }),
          prisma.auditlog.create({
            data: {
              id: crypto.randomUUID(),
              companyId: company.id,
              action: "CLIENT_PORTAL_LOGIN_SUCCESS",
              entityType: "ClientPortalAccount",
              entityId: account.id,
              metadata: JSON.stringify({
                customerId: account.customerId,
                displayClientCode: account.displayClientCode,
              }),
            },
          }),
        ]);

        return {
          id: account.id,
          name: account.customer.name,
          email: account.email,
          companyId: company.id,
          companyName: company.portalDisplayName ?? company.name,
          scope: "CLIENT",
          roles: [],
          permissions: ["client_portal:view"],
          customerId: account.customerId,
          clientPortalAccountId: account.id,
          companySlug: company.portalSlug,
          displayClientCode: account.displayClientCode,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.companyId = user.companyId;
        token.activeCompanyId = user.companyId;
        token.companyName = user.companyName;
        token.scope = user.scope;
        token.roles = user.roles;
        token.permissions = user.permissions;
        token.customerId = user.customerId;
        token.clientPortalAccountId = user.clientPortalAccountId;
        token.companySlug = user.companySlug;
        token.displayClientCode = user.displayClientCode;
      }

      if (trigger === "update" && token.id && token.scope !== "CLIENT") {
        const accessProfile = await getAccessProfile(token.id);
        token.companyId = accessProfile.companyId;
        token.scope = accessProfile.scope;
        token.roles = accessProfile.roles;
        token.permissions = accessProfile.permissions;
        token.customerId = accessProfile.customerId;
        token.clientPortalAccountId = accessProfile.clientPortalAccountId;
        token.companySlug = accessProfile.companySlug;
        token.displayClientCode = accessProfile.displayClientCode;
      }

      // The company-switcher calls session.update({ activeCompanyId }) —
      // the server action that runs first already validated the target
      // company is one this user may switch into, so this just persists
      // that decision into the token. Any other update() call (e.g. the
      // profile-refresh above) simply won't include this field, leaving
      // activeCompanyId untouched.
      if (
        trigger === "update" &&
        token.scope !== "CLIENT" &&
        session &&
        typeof session === "object" &&
        "activeCompanyId" in session
      ) {
        token.activeCompanyId = (session as { activeCompanyId: string | null }).activeCompanyId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.companyId = token.companyId;
        session.user.activeCompanyId = token.activeCompanyId ?? token.companyId;
        session.user.companyName = token.companyName;
        session.user.scope = token.scope ?? "COMPANY";
        session.user.roles = token.roles ?? [];
        session.user.permissions = token.permissions ?? [];
        session.user.customerId = token.customerId ?? null;
        session.user.clientPortalAccountId = token.clientPortalAccountId ?? null;
        session.user.companySlug = token.companySlug ?? null;
        session.user.displayClientCode = token.displayClientCode ?? null;
      }

      return session;
    },
  },
};
