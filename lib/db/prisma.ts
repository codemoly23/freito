import { PrismaClient } from "@/lib/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/db/connection";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createPrismaAdapter(),
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = basePrisma;
}

export const prisma = new Proxy(basePrisma, {
  get(target, prop, receiver) {
    if (typeof prop === "string" && !(prop in target)) {
      const lower = prop.toLowerCase();
      if (lower in target) {
        return (target as unknown as Record<string, unknown>)[lower];
      }
    }
    return Reflect.get(target, prop, receiver);
  },
});
