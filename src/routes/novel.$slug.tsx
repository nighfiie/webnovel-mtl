import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ArrowLeft, Globe, Layers, Settings, Pencil } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { BookmarkButton } from "@/components/social/BookmarkButton";
import { NovelRating } from "@/components/NovelRating";
import { Reviews } from "@/components/social/Reviews";
import type { ChapterRecord, NovelRecord } from "@/lib/novels";

export const Route = createFileRoute("/novel/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug.replace(/-/g, " ")} — ReadNovel` },
      { name: "description", content: "Read chapters and dual-language translations on ReadNovel." },
      { property: "og:title", content: `${params.slug.replace(/-/g, " ")} — ReadNovel` },
      { property: "og:description", content: "Read chapters and dual-language translations on ReadNovel." },
      { property: "og:type", content: "book" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovelDetailPage,
});

function NovelDetailPage() {
  const { slug } = Route.useParams();
  const isAdmin = useIsAdmin();

  const { data: novel, isLoading: novelLoading } = useQuery({
    queryKey: ["novel", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("novels")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as NovelRecord | null;
    },
  });

  const { data: chapters = [], isLoading: chaptersLoading } = useQuery({
    queryKey: ["novel-chapters-list", novel?.id],
    enabled: Boolean(novel?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, novel_id, number, title, content_translated, content_original, created_at, updated_at")
        .eq("novel_id", novel?.id ?? "")
        .order("number", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as ChapterRecord[];
    },
  });

  if (novelLoading) {
    return (
      <div className="min-h-screen bg-[#0c1017] text-slate-300 flex items-center justify-center">
        Loading novel...
      </div>
    );
  }

  if (!novel) {
    return (
      <div className="min-h-screen bg-[#0c1017] text-slate-200 flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold">Novel not found</h1>
        <p className="mt-2 text-sm text-slate-400">This novel does not exist or has been removed.</p>
        <Link to="/" className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500">
          Back to Home
        </Link>
      </div>
    );
  }

  const firstChapter = chapters[0];

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0c1017]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> ReadNovel
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/browse" className="text-sm text-slate-300 hover:text-white">Browse</Link>
            {isAdmin && (
              <>
                <Link
                  to="/admin"
                  search={{ edit: novel.slug }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit Novel
                </Link>
                <Link
                  to="/admin/novels/$slug/chapters"
                  params={{ slug: novel.slug }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  <Settings className="h-3.5 w-3.5" /> Chapters
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <div className="mx-auto w-52 md:w-full">
            {novel.cover_url ? (
              <img
                src={novel.cover_url}
                alt={novel.title}
                className="aspect-[2/3] w-full rounded-xl border border-slate-800 object-cover shadow-lg"
              />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-500">
                <BookOpen className="h-10 w-10" />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 font-medium text-blue-300">
                  {novel.category}
                </span>
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 capitalize text-slate-300">
                  {novel.status}
                </span>
                {novel.language_mode === "dual" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 font-medium text-emerald-300">
                    <Globe className="h-3 w-3" /> Dual Language ({novel.original_language} / {novel.translated_language})
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
                {novel.title}
              </h1>
              {novel.original_title && (
                <p className="mt-1 text-base text-slate-400">{novel.original_title}</p>
              )}
              {novel.original_author && (
                <p className="mt-1 text-sm text-slate-400">Author: {novel.original_author}</p>
              )}
            </div>

            {novel.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {novel.genres.map((g) => (
                  <span key={g} className="rounded-md border border-slate-800 bg-slate-900/70 px-2 py-0.5 text-xs text-slate-300">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {novel.synopsis && (
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">
                {novel.synopsis}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {firstChapter && (
                <Link
                  to="/novel/$slug/chapter/$number"
                  params={{ slug: novel.slug, number: String(firstChapter.number) }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
                >
                  <BookOpen className="h-4 w-4" /> Start Reading (Ch. {firstChapter.number})
                </Link>
              )}
              <BookmarkButton novelId={novel.id} />
              <NovelRating novel={novel} showCount />
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-400">
                <Layers className="h-4 w-4" /> {novel.total_chapters} Chapters
              </span>
            </div>
          </div>
        </div>

        <section className="mt-10 border-t border-slate-800 pt-8">
          <h2 className="text-lg font-semibold text-white">Chapters</h2>
          {chaptersLoading ? (
            <p className="mt-4 text-sm text-slate-400">Loading chapters...</p>
          ) : chapters.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No chapters available yet.</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {chapters.map((ch) => (
                <Link
                  key={ch.id}
                  to="/novel/$slug/chapter/$number"
                  params={{ slug: novel.slug, number: String(ch.number) }}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-800/80 bg-[#121822] px-4 py-3 text-sm transition-colors hover:border-blue-500/50 hover:bg-slate-900"
                >
                  <span className="truncate font-medium text-slate-200">
                    Ch. {ch.number}: {ch.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-slate-400">
                    {ch.content_translated && ch.content_original ? "Translated + Original" : ch.content_translated ? "Translated" : "Original"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <Reviews novelId={novel.id} aggregate={novel} />
      </main>
    </div>
  );
}