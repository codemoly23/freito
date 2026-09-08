import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Mirrors lib/communications/encryption.ts, but keyed by AI_SECRET_KEY so a
// company's AI provider key has its own encryption boundary, independent of
// communication provider credentials.
type EncryptedPayload = {
  version: 1;
  iv: string;
  tag: string;
  data: string;
};

function encryptionKey() {
  const secret = process.env.AI_SECRET_KEY?.trim();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

export function aiEncryptionAvailable() {
  return Boolean(encryptionKey());
}

export function encryptAiApiKey(apiKey: string): EncryptedPayload {
  const key = encryptionKey();
  if (!key) throw new Error("AI_SECRET_KEY is required to save a company AI API key.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
}

export function decryptAiApiKey(payload: unknown): string {
  const key = encryptionKey();
  if (!key) throw new Error("AI_SECRET_KEY is required to read a company AI API key.");
  if (!payload || typeof payload !== "object") throw new Error("Encrypted AI API key is missing.");
  const value = payload as Partial<EncryptedPayload>;
  if (value.version !== 1 || !value.iv || !value.tag || !value.data) {
    throw new Error("Encrypted AI API key is invalid.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(value.data, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}
