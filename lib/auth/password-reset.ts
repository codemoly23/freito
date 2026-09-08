import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";

const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MINUTES = 30;

export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(userId: string) {
  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordresettoken.deleteMany({
    where: {
      userId,
      usedAt: null,
    },
  });

  await prisma.passwordresettoken.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
  };
}

export function getPasswordResetUrl(token: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://127.0.0.1:3000";
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}
