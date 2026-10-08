import type { SiteSection } from "@/lib/site-pages";
import heroHome from "@/assets/hero-home.jpg";
import familyStyleview from "@/assets/family-styleview.jpg";
import familyStyleguard from "@/assets/family-styleguard.jpg";
import familyPrecedence from "@/assets/family-precedence.jpg";
import detailFrame from "@/assets/detail-frame.jpg";
import builders from "@/assets/builders.jpg";

/** Maps the editor's image filename values to bundled assets. */
export const SITE_IMAGE_MAP: Record<string, string> = {
  "hero-home.jpg": heroHome,
  "family-styleview.jpg": familyStyleview,
  "family-styleguard.jpg": familyStyleguard,
  "family-precedence.jpg": familyPrecedence,
  "detail-frame.jpg": detailFrame,
  "builders.jpg": builders,
};

export function siteImageSrc(filename: string): string | undefined {
  return filename ? SITE_IMAGE_MAP[filename] : undefined;
}

/** Tailwind font class for a section's heading font override. */
export function sectionFontClass(section: SiteSection): string {
  if (section.font === "serif") return "font-serif";
  if (section.font === "sans") return "font-sans";
  return "";
}
