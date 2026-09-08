import path from "node:path";

export const maxLogoFileSize = 2 * 1024 * 1024;

const logoTypes = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
]);

export function validateLogoFile(file: File) {
  if (!file.size) return "Select a logo image.";
  if (file.size > maxLogoFileSize) return "Logo must be 2MB or smaller.";
  if (!logoTypes.has(file.type)) return "Logo must be PNG, JPG, JPEG, or WebP.";
  return null;
}

export function logoExtension(file: File) {
  return logoTypes.get(file.type) ?? ".img";
}

export function brandingStorageRoot() {
  return path.join(process.cwd(), "storage", "branding");
}
