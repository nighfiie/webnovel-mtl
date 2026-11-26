import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";
import { Button } from "@/components/ui/button";
import { NovelRating } from "@/components/NovelRating";
import { validateReview } from "@/lib/social";

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Button key={n} type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={!onChange} onClick={() => onChange?.(n)} aria-label={`${n} stars`}>
          <Star className={`h-4 w-4 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-600"}`} />
        </Button>
      ))}
    </div>
  );
}

export function Reviews({ novelId, aggregate }: { novelId: string; aggregate: { rating: number; reviews_count: number } }) {
  const user = useSessionUser();
  const qc = useQueryClient();
  const { data: reviews = [] } = useQuery({
    enabled: Boolean(user),
    queryKey: ["reviews", novelId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_novel_reviews", { _novel_id: novelId });
      if (error) throw error;
      return data ?? [];
    },
  });
  const mine = reviews.find((r) => r.user_id === user?.id);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  useEffect(() => { if (mine) { setRating(mine.rating); setBody(mine.body); } }, [mine]);
  function refreshRatings() {
    void qc.invalidateQueries({ queryKey: ["reviews", novelId] });
    void qc.invalidateQueries({ queryKey: ["novel"] });
    void qc.invalidateQueries({ queryKey: ["catalog", "public"] });
    void qc.invalidateQueries({ queryKey: ["admin-novels"] });
  }

  const submit = async () => {
    if (!user) return undefined;
    const err = validateReview(rating, body);
    if (err) { toast.error(err); return; }
    const { error } = await supabase.from("reviews").upsert({ user_id: user.id, novel_id: novelId, rating, body, updated_at: new Date().toISOString() }, { onConflict: "user_id,novel_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Review saved");
    refreshRatings();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRating(0); setBody("");
    refreshRatings();
  };

  return (
    <section className="mt-10 border-t border-slate-800 pt-8">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold text-white">Reviews</h2>
        <NovelRating novel={aggregate} showCount />
      </div>
      {user ? (
        <div className="mt-4 space-y-2 rounded-lg border border-slate-800 bg-[#121822] p-4">
          <p className="text-sm text-slate-300">{mine ? "Edit your review" : "Write a review"}</p>
          <Stars value={rating} onChange={setRating} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={5000} placeholder="What did you think?" className="w-full rounded-md border border-slate-700 bg-[#0c1017] p-2 text-sm text-slate-100" />
          <Button onClick={submit}>Save review</Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400"><Link to="/auth" search={{ redirect: typeof window !== "undefined" ? window.location.pathname : "/" }} className="text-blue-400 hover:underline">Sign in</Link> to rate and review.</p>
      )}
      <div className="mt-4 space-y-3">
        {user && reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-lg border border-slate-800/70 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm"><span className="font-medium text-slate-200">{r.display_name ?? "Reader"}</span><Stars value={r.rating} /></div>
              {r.user_id === user?.id && <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Delete review"><Trash2 className="h-4 w-4 text-slate-500 hover:text-red-400" /></Button>}
            </div>
            {r.body && <p className="mt-1 whitespace-pre-line text-sm text-slate-300">{r.body}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
