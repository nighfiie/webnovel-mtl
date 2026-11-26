import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSessionUser } from "@/hooks/use-session-user";

export function MyBookmarks() {
  const user = useSessionUser();
  const { data = [] } = useQuery({
    queryKey: ["my-bookmarks", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [b, p] = await Promise.all([
        supabase.from("bookmarks").select("novel_id,novels(slug,title,cover_url)").order("created_at", { ascending: false }),
        supabase.from("reading_progress").select("novel_id,chapter_number"),
      ]);
      const prog = new Map((p.data ?? []).map((r) => [r.novel_id, r.chapter_number]));
      return (b.data ?? []).filter((r) => r.novels).map((r) => ({ ...r.novels!, chapter: prog.get(r.novel_id) ?? null }));
    },
  });
  if (!user || data.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-white">My Bookmarks</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {data.map((n) => (
          <Link key={n.slug} to={n.chapter != null ? "/novel/$slug/chapter/$number" : "/novel/$slug"} params={{ slug: n.slug, number: String(n.chapter ?? 1) }} className="w-28 shrink-0">
            {n.cover_url ? <img src={n.cover_url} alt={n.title} className="aspect-[2/3] w-full rounded-lg object-cover" /> : <div className="aspect-[2/3] w-full rounded-lg bg-slate-800" />}
            <p className="mt-1 line-clamp-2 text-xs text-slate-200">{n.title}</p>
            {n.chapter != null && <p className="text-[11px] text-blue-400">Ch. {n.chapter}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}
