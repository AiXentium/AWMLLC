import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signedUrls } from "@/lib/storage-client";

export type PageRow = {
  id: string;
  page_number: number;
  sheet_number: string | null;
  title: string | null;
  discipline: string | null;
  building: string | null;
  floor: string | null;
  state: string;
  thumbnail_path: string | null;
  processing_error: string | null;
};

export function usePages(projectId: string) {
  return useQuery({
    queryKey: ["pages", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pages")
        .select(
          "id,page_number,sheet_number,title,discipline,building,floor,state,thumbnail_path,processing_error",
        )
        .eq("project_id", projectId)
        .order("page_number");
      if (error) throw error;
      return data as PageRow[];
    },
  });
}

export function useThumbnails(pages: PageRow[]) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const key = pages
    .map((p) => p.thumbnail_path)
    .filter(Boolean)
    .join("|");
  useEffect(() => {
    const paths = pages.map((p) => p.thumbnail_path).filter((p): p is string => Boolean(p));
    if (!paths.length) return;
    let cancelled = false;
    // Fetch the first batch immediately so the visible sidebar populates fast;
    // defer the rest until the browser is idle so the main sheet renders first.
    const first = paths.slice(0, 12);
    const rest = paths.slice(12);
    const load = async () => {
      try {
        const map = await signedUrls("plan-files", first);
        if (!cancelled) setUrls(new Map(map));
        if (rest.length && !cancelled) {
          await new Promise<void>((resolve) => {
            const w = window as unknown as {
              requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
            };
            if (typeof w.requestIdleCallback === "function") {
              w.requestIdleCallback(() => resolve(), { timeout: 3000 });
            } else {
              window.setTimeout(() => resolve(), 1500);
            }
          });
          if (cancelled) return;
          const map2 = await signedUrls("plan-files", rest);
          if (!cancelled) setUrls(new Map([...map, ...map2]));
        }
      } catch {
        // Thumbnails are non-critical — a failed batch must not break the page.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}
