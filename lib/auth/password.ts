import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function generateOneTimePassword(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const bytes = randomBytes(6);
  let randomStr = "";
  for (let i = 0; i < 6; i += 1) {
    randomStr += chars[bytes[i] % chars.length];
  }
  return `Pass-${randomStr}`;
}

