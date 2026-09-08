import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type EncryptedPayload = {
  version: 1;
  iv: string;
  tag: string;
  data: string;
};

function encryptionKey() {
  const secret = process.env.COMMUNICATION_SECRET_KEY?.trim();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function communicationEncryptionAvailable() {
  return Boolean(encryptionKey());
}

export function encryptCommunicationConfig(config: Record<string, unknown>): EncryptedPayload {
  const key = encryptionKey();
  if (!key) throw new Error("COMMUNICATION_SECRET_KEY is required to save communication credentials.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(config), "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
}

export function decryptCommunicationConfig<T>(payload: unknown): T {
  const key = encryptionKey();
  if (!key) throw new Error("COMMUNICATION_SECRET_KEY is required to read communication credentials.");
  if (!payload || typeof payload !== "object") throw new Error("Encrypted communication configuration is missing.");
  const value = payload as Partial<EncryptedPayload>;
  if (value.version !== 1 || !value.iv || !value.tag || !value.data) {
    throw new Error("Encrypted communication configuration is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(value.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as T;
}
