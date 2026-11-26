import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { validateComment } from "@/lib/social";

export function Comments({ chapterId }: { chapterId: string }) {
  const user = useSessionUser();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const { data: comments = [] } = useQuery({
    enabled: Boolean(user),
    queryKey: ["comments", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_chapter_comments", { _chapter_id: chapterId });
      if (error) throw error;
      return data ?? [];
    },
  });
  const post = async () => {
    if (!user) return undefined;
    const err = validateComment(body);
    if (err) { toast.error(err); return; }
    const { error } = await supabase.from("comments").insert({ chapter_id: chapterId, user_id: user.id, body: body.trim() });
    if (error) { toast.error(error.message); return; }
    setBody("");
    qc.invalidateQueries({ queryKey: ["comments", chapterId] });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["comments", chapterId] });
  };
  return (
    <section className="mt-10 border-t border-slate-800 pt-6">
      <h2 className="text-lg font-semibold text-white">Comments ({comments.length})</h2>
      {user ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} placeholder="Share your thoughts on this chapter..." className="w-full rounded-md border border-slate-700 bg-[#121822] p-2 text-sm text-slate-100" />
          <button onClick={post} className="self-end rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500">Post comment</button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-400"><Link to="/auth" search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" }} className="text-blue-400 hover:underline">Sign in</Link> to join the discussion.</p>
      )}
      <div className="mt-4 space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-800/70 bg-[#121822]/60 p-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span><span className="font-medium text-slate-200">{c.display_name ?? "Reader"}</span> · {new Date(c.created_at).toLocaleString()}</span>
              {c.user_id === user?.id && <button onClick={() => remove(c.id)} aria-label="Delete comment"><Trash2 className="h-3.5 w-3.5 hover:text-red-400" /></button>}
            </div>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-200">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
