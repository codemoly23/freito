const forbiddenShareTerms = [
  "buy cost",
  "gross profit",
  "profit margin",
  "vendor cost",
  "employee assignment",
  "agent assignment",
  "internal notes",
  "handler type",
];

export function assertInternalPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) throw new Error("Share links must use internal application paths.");
  return path;
}

export function buildInternalShareLink(path: string) {
  const safePath = assertInternalPath(path);
  const appUrl = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace("://127.0.0.1", "://localhost").replace(/\/$/, "");
  return `${appUrl}${safePath}`;
}

export function sanitizeShareMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  if (forbiddenShareTerms.some((term) => lower.includes(term))) {
    throw new Error("Share message contains internal-only information.");
  }
  return normalized;
}

export function buildWhatsAppShareUrl(phone: string | null | undefined, message: string) {
  const text = encodeURIComponent(sanitizeShareMessage(message));
  const digits = phone?.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function buildEmailShareUrl(email: string | null | undefined, subject: string, body: string) {
  const recipient = email?.trim() ?? "";
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(sanitizeShareMessage(subject))}&body=${encodeURIComponent(sanitizeShareMessage(body))}`;
}
