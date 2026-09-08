export function getQAPrefix() {
  const now = new Date();
  return `QA-${now.getTime()}`;
}

export function generateTestName(baseName: string) {
  return `${getQAPrefix()}-${baseName}`;
}

export function generateTestEmail(baseName: string) {
  return `${getQAPrefix()}-${baseName}@example.com`.toLowerCase();
}
