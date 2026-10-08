import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type SiteResourceCategory = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
};

export type SiteResource = {
  id: string;
  category_slug: string;
  title: string;
  description: string | null;
  product_category: string | null;
  series: string | null;
  file_type: string;
  file_size_bytes: number | null;
  external_url: string | null;
  thumbnail_url: string | null;
  is_featured: boolean;
  published_at: string;
};

export type ResourceLibrary = {
  categories: SiteResourceCategory[];
  resources: SiteResource[];
};

function publicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const getResourceLibrary = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResourceLibrary> => {
    const supabase = publicClient();

    const [categoriesResult, resourcesResult] = await Promise.all([
      supabase
        .from("site_resource_categories")
        .select("slug,name,description,icon,sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("site_resources")
        .select(
          "id,category_slug,title,description,product_category,series,file_type,file_size_bytes,external_url,thumbnail_url,is_featured,published_at",
        )
        .eq("is_published", true)
        .order("published_at", { ascending: false }),
    ]);

    if (categoriesResult.error) throw categoriesResult.error;
    if (resourcesResult.error) throw resourcesResult.error;

    return {
      categories: (categoriesResult.data ?? []) as SiteResourceCategory[],
      resources: (resourcesResult.data ?? []) as SiteResource[],
    };
  },
);
