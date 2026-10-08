/**
 * Visual site editor data layer.
 *
 * Backed by the `site_pages` table (migration 20261005000000_site_pages.sql).
 * The generated Supabase Database types may not include the newest tables
 * yet, so this module talks through an untyped client handle and casts
 * rows to the local `SitePage` interface at the boundary.
 *
 * IMPORTANT: `useSitePage` must NEVER break the public site. If the table
 * does not exist yet (migration unpushed) or the query fails for any
 * reason, it resolves to null and callers fall back to hardcoded content.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any, "public", any>;

export type SiteSectionType = "hero" | "text" | "features" | "cta" | "gallery";

export const SITE_SECTION_TYPES: { value: SiteSectionType; label: string }[] = [
  { value: "hero", label: "Hero banner" },
  { value: "text", label: "Text block" },
  { value: "features", label: "Feature grid" },
  { value: "cta", label: "Call to action" },
  { value: "gallery", label: "Image gallery" },
];

export const SITE_FONTS: { value: string; label: string }[] = [
  { value: "", label: "Site default" },
  { value: "serif", label: "Serif — elegant" },
  { value: "sans", label: "Sans — clean" },
];

export interface SiteSectionItem {
  title: string;
  text: string;
}

export interface SiteSection {
  id: string;
  type: SiteSectionType;
  order: number;
  eyebrow?: string;
  heading: string;
  body: string;
  /** Font override: "" = site default, "serif", "sans". */
  font?: string;
  /** Asset filename from src/assets, e.g. "hero-home.jpg". Empty = none. */
  image: string;
  cta_label: string;
  cta_href: string;
  /** Feature-grid cards / gallery captions. */
  items: SiteSectionItem[];
}

export interface SitePage {
  id: string;
  slug: string;
  title: string;
  content: { sections: SiteSection[] };
  is_published: boolean;
  updated_at: string;
}

export interface SitePageInput {
  title: string;
  content: { sections: SiteSection[] };
  is_published: boolean;
}

/** Image choices for the editor — files that exist in src/assets. */
export const SITE_IMAGES: { value: string; label: string }[] = [
  { value: "", label: "No image" },
  { value: "hero-home.jpg", label: "Hero — Florida home" },
  { value: "family-styleview.jpg", label: "StyleView family" },
  { value: "family-styleguard.jpg", label: "StyleGuard family" },
  { value: "family-precedence.jpg", label: "Precedence family" },
  { value: "detail-frame.jpg", label: "Frame detail" },
  { value: "builders.jpg", label: "Builders / jobsite" },
];

export function newSectionId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function blankSection(type: SiteSectionType, order: number): SiteSection {
  return {
    id: newSectionId(),
    type,
    order,
    eyebrow: "",
    heading: "New section",
    body: "",
    font: "",
    image: "",
    cta_label: "",
    cta_href: "",
    items: type === "features" ? [{ title: "Feature", text: "Describe it here." }] : [],
  };
}

function normalizePage(row: Record<string, unknown>): SitePage {
  const raw = (row.content ?? {}) as { sections?: unknown };
  const sections = Array.isArray(raw.sections) ? (raw.sections as SiteSection[]) : [];
  return {
    id: String(row.id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    content: { sections: sections.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) },
    is_published: Boolean(row.is_published),
    updated_at: String(row.updated_at ?? ""),
  };
}

export const SITE_PAGES_QUERY_KEY = ["site-pages"] as const;
export const sitePageQueryKey = (slug: string) => ["site-page", slug] as const;

/**
 * Public hook: fetch the published page by slug. Resolves to null when the
 * table is missing, the row is missing/unpublished, or the query fails —
 * never throws, so the public site always falls back to hardcoded content.
 */
export function useSitePage(slug: string) {
  return useQuery({
    queryKey: sitePageQueryKey(slug),
    queryFn: async (): Promise<SitePage | null> => {
      try {
        const { data, error } = await db
          .from("site_pages")
          .select("id,slug,title,content,is_published,updated_at")
          .eq("slug", slug)
          .eq("is_published", true)
          .maybeSingle();
        if (error || !data) return null;
        return normalizePage(data as Record<string, unknown>);
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/** Admin hook: list every page (published or not) for the editor. */
export function useSitePages() {
  return useQuery({
    queryKey: SITE_PAGES_QUERY_KEY,
    queryFn: async (): Promise<SitePage[]> => {
      const { data, error } = await db
        .from("site_pages")
        .select("id,slug,title,content,is_published,updated_at")
        .order("slug", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(normalizePage);
    },
    retry: false,
  });
}

export function useSaveSitePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: SitePageInput }) => {
      const { error } = await db
        .from("site_pages")
        .update({ ...input, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: SITE_PAGES_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: ["site-page"] });
    },
  });
}
