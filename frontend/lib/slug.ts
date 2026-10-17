// Same rule as the server: lowercase letters and numbers, separated by single hyphens.
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// "Rasel's Gadgets!" -> "rasel-s-gadgets"
// Names in other scripts (for example Bangla) produce nothing, and the seller types an address by hand.
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}
