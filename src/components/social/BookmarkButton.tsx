import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";

export function BookmarkButton({ novelId }: { novelId: string }) {
  const user = useSessionUser();
  const qc = useQueryClient();
  const key = ["bookmark", user?.id, novelId];
  const { data: saved } = useQuery({
    queryKey: key,
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await supabase.from("bookmarks").select("id").eq("novel_id", novelId).maybeSingle();
      return Boolean(data);
    },
  });
  if (!user) {
    return <Link to="/auth" search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" }} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"><Bookmark className="h-4 w-4" /> Sign in to bookmark</Link>;
  }
  const toggle = async () => {
    const { error } = saved
      ? await supabase.from("bookmarks").delete().eq("novel_id", novelId).eq("user_id", user.id)
      : await supabase.from("bookmarks").insert({ novel_id: novelId, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    qc.setQueryData(key, !saved);
    qc.invalidateQueries({ queryKey: ["my-bookmarks"] });
    toast.success(saved ? "Removed from library" : "Added to your library");
  };
  return (
    <button onClick={toggle} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
      {saved ? <BookmarkCheck className="h-4 w-4 text-blue-400" /> : <Bookmark className="h-4 w-4" />} {saved ? "In Library" : "Add to Library"}
    </button>
  );
}
