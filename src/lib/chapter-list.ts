import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { collectChapterPages } from "@/lib/chapter-navigation";

// Shared metadata-only cache for the overview and reader navigation.
export function chapterListOptions(novelId: string) {
  return queryOptions({
    queryKey: ["novel-chapters-list", novelId],
    enabled: Boolean(novelId),
    queryFn: () => collectChapterPages(async (from, to) => {
      const { data, error } = await supabase.from("chapters")
        .select("id,number,title")
        .eq("novel_id", novelId)
        .order("number", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return data ?? [];
    }),
  });
}