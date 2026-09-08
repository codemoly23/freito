import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export function createPrismaAdapter() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const url = new URL(databaseUrl);

  const isAzure =
    url.hostname.endsWith(".mysql.database.azure.com");

  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectTimeout: 15000,
    acquireTimeout: 15000,
    idleTimeout: 30000,
    connectionLimit: 10,
    allowPublicKeyRetrieval: !isAzure,
    ssl: isAzure
      ? {
        rejectUnauthorized: false,
      }
      : undefined,
  });
}