import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search, Shuffle } from "lucide-react";
import { NOVEL_GENRES, NOVEL_STATUSES } from "@/lib/novels";
import { publicCatalogOptions } from "@/lib/public-catalog";
import { CatalogError, CatalogNotFound } from "@/components/catalog/CatalogShell";
import { MyBookmarks } from "@/components/social/MyBookmarks";
import { applyCatalogFilters, cycleTriState, PROGRESS_KEY, type ProgressEntry, type SortKey, type TriState } from "@/lib/catalog";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "Novel Library — Search & Filter | ReadNovel" },
      { name: "description", content: "Search every novel on ReadNovel by title or author and filter by genre and status." },
      { property: "og:title", content: "Novel Library — Search & Filter | ReadNovel" },
      { property: "og:description", content: "Search every novel on ReadNovel by title or author and filter by genre and status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(publicCatalogOptions); },
  errorComponent: CatalogError,
  notFoundComponent: CatalogNotFound,
  component: LibraryPage,
});

const SORTS: { id: SortKey; label: string }[] = [
  { id: "recent", label: "Most Recent" },
  { id: "popular", label: "Popularity" },
  { id: "rating", label: "Highest Rated" },
  { id: "title", label: "Title" },
];

function LibraryPage() {
  const [query, setQuery] = useState("");
  const [genres, setGenres] = useState<Record<string, TriState>>({});
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [ascending, setAscending] = useState(false);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    try { setProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) || "[]")); } catch { /* storage unavailable */ }
  }, []);

  const { data: { novels } } = useSuspenseQuery(publicCatalogOptions);

  const results = useMemo(
    () => applyCatalogFilters(novels, { query, genres, status, sort, ascending }),
    [novels, query, genres, status, sort, ascending],
  );
  const random = novels.length ? novels[Math.floor(Math.random() * novels.length)] : null;

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Novel Library</h1>
          <div className="flex gap-2">
            <Link to="/" className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">Home</Link>
            {random && (
              <Link to="/novel/$slug" params={{ slug: random.slug }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500">
                <Shuffle className="h-4 w-4" /> Surprise Me
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6"><MyBookmarks /></div>

        {progress.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Continue Reading</h2>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {progress.slice(0, 10).map((p) => (
                <Link key={p.slug} to="/novel/$slug/chapter/$number" params={{ slug: p.slug, number: String(p.chapter) }}
                  className="shrink-0 rounded-lg border border-slate-800 bg-[#121822] px-3 py-2 text-sm hover:border-blue-500">
                  <div className="max-w-[200px] truncate font-medium">{p.title}</div>
                  <div className="text-xs text-blue-400">Resume Ch. {p.chapter}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, original title or author…"
            className="w-full rounded-lg border border-slate-800 bg-[#121822] py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
        </div>

        <div className="mt-4">
          <p className="text-xs text-slate-500">Genres — click once to include (+), twice to exclude (−), again to clear.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {NOVEL_GENRES.map((g) => {
              const st = genres[g];
              return (
                <button key={g} type="button"
                  onClick={() => setGenres((prev) => { const n = { ...prev }; const v = cycleTriState(prev[g]); if (v) n[g] = v; else delete n[g]; return n; })}
                  className={`rounded-full border px-3 py-1 text-xs ${st === "include" ? "border-emerald-500 bg-emerald-600/20 text-emerald-300" : st === "exclude" ? "border-red-500 bg-red-600/20 text-red-300 line-through" : "border-slate-800 text-slate-300 hover:border-slate-600"}`}>
                  {st === "include" ? "+ " : st === "exclude" ? "− " : ""}{g}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-800 bg-[#121822] px-2 py-1.5">
            <option value="">Any status</option>
            {NOVEL_STATUSES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-lg border border-slate-800 bg-[#121822] px-2 py-1.5">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button type="button" aria-label="Toggle sort direction" onClick={() => setAscending((a) => !a)} className="rounded-lg border border-slate-800 bg-[#121822] p-1.5">
            {ascending ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
          </button>
          <span className="ml-auto text-slate-400">{results.length} novels</span>
        </div>

        {results.length === 0 ? (
          <p className="mt-10 text-center text-slate-400">No novels match these filters.</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((n) => (
              <Link key={n.id} to="/novel/$slug" params={{ slug: n.slug }} className="group">
                <div className="aspect-[3/4] overflow-hidden rounded-lg bg-[#121822]">
                  {n.cover_url ? <img src={n.cover_url} alt={n.title} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                    : <div className="flex h-full items-center justify-center p-2 text-center text-xs text-slate-500">{n.title}</div>}
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-medium group-hover:text-blue-400">{n.title}</div>
                <div className="text-xs text-slate-500">{n.total_chapters} ch · {n.status}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
