import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ExportItem } from "@/lib/exports/excel-export";

const SELECT_COLUMNS =
  "id,mark,description,category,product_type,system,frame_type,glass,operation,building,floor,unit,room,elevation,quantity,width_in,height_in,impact,status,notes,ai_confidence,primary_image_path,page_id,pages(sheet_number,page_number,title)";

export type Row = ExportItem & {
  page_id: string | null;
  pages: { sheet_number: string | null; page_number: number; title: string | null } | null;
};

export function useTakeoffItems(projectId: string) {
  return useQuery({
    queryKey: ["takeoff-items", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("takeoff_items")
        .select(SELECT_COLUMNS)
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });
}
