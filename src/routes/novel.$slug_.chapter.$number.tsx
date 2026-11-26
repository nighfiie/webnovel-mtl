import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Columns2, Download, Languages, List, Minus, Plus, Type, Pencil } from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useNavigate } from "@tanstack/react-router";
import { READER_FONTS, DEFAULT_READER, parseReaderSettings, countWords, upsertProgress, PROGRESS_KEY, type ReaderSettings, type ProgressEntry } from "@/lib/catalog";
import { Comments } from "@/components/social/Comments";
import { supabase } from "@/integrations/supabase/client";
import { splitParagraphs, type ChapterRecord, type NovelRecord } from "@/lib/novels";

type DisplayMode = "translated" | "original" | "both";

export const Route = createFileRoute("/novel/$slug_/chapter/$number")({
  head: ({ params }) => ({
    meta: [
      { title: `Chapter ${params.number} — ReadNovel` },
      { name: "description", content: "Dual-language web novel reader on ReadNovel." },
      { property: "og:title", content: `Chapter ${params.number} — ReadNovel` },
      { property: "og:description", content: "Dual-language web novel reader on ReadNovel." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChapterReaderPage,
});

function ChapterReaderPage() {
  const { slug, number } = Route.useParams();
  const chapterNum = Number(number);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("translated");
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_READER);
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  useEffect(() => {
    try { setSettings(parseReaderSettings(localStorage.getItem("readnovel-reader"))); } catch { /* storage unavailable */ }
  }, []);
  const updateSettings = (patch: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem("readnovel-reader", JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  };
  const fontSize = settings.size;
  const setFontSize = (fn: (s: number) => number) => updateSettings({ size: fn(settings.size) });

  const { data: novel } = useQuery({
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

  const { data: chapter, isLoading } = useQuery({
    queryKey: ["chapter", novel?.id, chapterNum],
    enabled: Boolean(novel?.id) && Number.isFinite(chapterNum),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("novel_id", novel!.id)
        .eq("number", chapterNum)
        .maybeSingle();
      if (error) throw error;
      return data as ChapterRecord | null;
    },
  });

  const { data: neighbors } = useQuery({
    queryKey: ["chapter-neighbors", novel?.id, chapterNum],
    enabled: Boolean(novel?.id) && Number.isFinite(chapterNum),
    queryFn: async () => {
      const [prevRes, nextRes] = await Promise.all([
        supabase
          .from("chapters")
          .select("number")
          .eq("novel_id", novel!.id)
          .lt("number", chapterNum)
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("chapters")
          .select("number")
          .eq("novel_id", novel!.id)
          .gt("number", chapterNum)
          .order("number", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        prev: prevRes.data?.number ?? null,
        next: nextRes.data?.number ?? null,
      };
    },
  });

  const { data: chapterList } = useQuery({
    queryKey: ["chapter-list", novel?.id],
    enabled: Boolean(novel?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chapters")
        .select("number,title")
        .eq("novel_id", novel!.id)
        .order("number", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!novel || !chapter) return;
    try {
      const list = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "[]") as ProgressEntry[];
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(upsertProgress(list, { slug, title: novel.title, chapter: chapter.number, at: Date.now() })));
    } catch { /* storage unavailable */ }
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      void supabase.from("reading_progress").upsert({ user_id: data.user.id, novel_id: novel.id, chapter_number: chapter.number, updated_at: new Date().toISOString() });
    });
  }, [novel, chapter, slug]);

  if (isLoading || !novel) {
    return (
      <div className="min-h-screen bg-[#0c1017] text-slate-300 flex items-center justify-center">
        Loading chapter...
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-[#0c1017] text-slate-200 flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold">Chapter not found</h1>
        <Link
          to="/novel/$slug"
          params={{ slug }}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500"
        >
          Back to Novel
        </Link>
      </div>
    );
  }

  const isDual = novel.language_mode === "dual";
  const translatedParas = splitParagraphs(chapter.content_translated);
  const originalParas = splitParagraphs(chapter.content_original);
  const maxPairs = Math.max(translatedParas.length, originalParas.length);

  // If user chose translated but none exists yet, gracefully show notice + original fallback option
  const effectiveMode: DisplayMode = !isDual ? "translated" : displayMode;
  const stats = countWords(effectiveMode === "original" ? chapter.content_original : chapter.content_translated || chapter.content_original);
  const fontCss = READER_FONTS.find((f) => f.id === settings.font)?.css ?? "serif";
  const downloadChapter = () => {
    const body = [chapter.title, "", chapter.content_translated ?? "", chapter.content_original ? "\n---\n\n" + chapter.content_original : ""].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-chapter-${chapter.number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-[#0c1017]/95 backdrop-blur">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 max-w-5xl">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to="/novel/$slug"
              params={{ slug }}
              className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="truncate max-w-[180px] sm:max-w-xs">{novel.title}</span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && chapter && (
              <Link
                to="/admin/novels/$slug/chapters/$chapterId"
                params={{ slug, chapterId: chapter.id }}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Link>
            )}
            {isDual && (
              <div className="inline-flex rounded-lg border border-slate-800 bg-[#121822] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setDisplayMode("translated")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    effectiveMode === "translated" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {novel.translated_language || "English"}
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode("original")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                    effectiveMode === "original" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Languages className="h-3.5 w-3.5" /> {novel.original_language || "Original"}
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode("both")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-colors ${
                    effectiveMode === "both" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Columns2 className="h-3.5 w-3.5" /> Side by Side
                </button>
              </div>
            )}

            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-[#121822] px-2 py-1 text-xs">
              <button
                type="button"
                aria-label="Decrease font size"
                onClick={() => setFontSize((s) => Math.max(12, s - 2))}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-7 text-center tabular-nums text-slate-300">{fontSize}</span>
              <button
                type="button"
                aria-label="Increase font size"
                onClick={() => setFontSize((s) => Math.min(32, s + 2))}
                className="p-0.5 text-slate-400 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button type="button" aria-label="Reader settings" onClick={() => setShowSettings((v) => !v)} className="rounded-lg border border-slate-800 bg-[#121822] p-1.5 text-slate-300 hover:text-white">
              <Type className="h-4 w-4" />
            </button>
            <button type="button" aria-label="Download chapter" onClick={downloadChapter} className="rounded-lg border border-slate-800 bg-[#121822] p-1.5 text-slate-300 hover:text-white">
              <Download className="h-4 w-4" />
            </button>
            {chapterList && chapterList.length > 0 && (
              <select
                aria-label="Jump to chapter"
                value={chapter.number}
                onChange={(e) => navigate({ to: "/novel/$slug/chapter/$number", params: { slug, number: e.target.value } })}
                className="max-w-[160px] rounded-lg border border-slate-800 bg-[#121822] px-2 py-1 text-xs text-slate-200"
              >
                {chapterList.map((c) => (
                  <option key={c.number} value={c.number}>Ch. {c.number}: {c.title}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        {showSettings && (
          <div className="mx-auto max-w-5xl border-t border-slate-800 px-4 py-3 text-xs text-slate-300">
            <div className="flex flex-wrap gap-1.5">
              {READER_FONTS.map((f) => (
                <button key={f.id} type="button" onClick={() => updateSettings({ font: f.id })} style={{ fontFamily: f.css }}
                  className={`rounded-md border px-2.5 py-1 text-sm ${settings.font === f.id ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-[#121822] hover:text-white"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2">Size
                <input type="range" min={12} max={32} value={settings.size} onChange={(e) => updateSettings({ size: Number(e.target.value) })} />
                <span className="tabular-nums">{settings.size}px</span>
              </label>
              <label className="flex items-center gap-2">Line height
                <input type="range" min={1.2} max={2.6} step={0.05} value={settings.lineHeight} onChange={(e) => updateSettings({ lineHeight: Number(e.target.value) })} />
                <span className="tabular-nums">{settings.lineHeight.toFixed(2)}</span>
              </label>
            </div>
          </div>
        )}
      </header>

      <main className={`mx-auto px-4 py-8 ${effectiveMode === "both" ? "max-w-5xl" : "max-w-3xl"}`}>
        <div className="mb-8 border-b border-slate-800 pb-6 text-center">
          <p className="text-xs uppercase tracking-wider text-blue-400">Chapter {chapter.number}</p>
          <h1 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{chapter.title}</h1>
          <p className="mt-2 text-xs text-slate-500">{stats.words.toLocaleString()} words · {stats.chars.toLocaleString()} characters</p>
        </div>

        <article style={{ fontSize: `${fontSize}px`, lineHeight: settings.lineHeight, fontFamily: fontCss }}>
          {effectiveMode === "translated" && (
            translatedParas.length > 0 ? (
              <div className="space-y-5 text-slate-200">
                {translatedParas.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-[#121822] p-6 text-center text-sm text-slate-400">
                <p>No English translation yet for this chapter.</p>
                {originalParas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDisplayMode("original")}
                    className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
                  >
                    View {novel.original_language || "Original"} Text
                  </button>
                )}
              </div>
            )
          )}

          {effectiveMode === "original" && (
            originalParas.length > 0 ? (
              <div className="space-y-5 text-slate-200">
                {originalParas.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-slate-400">No original text stored for this chapter.</p>
            )
          )}

          {effectiveMode === "both" && (
            <div className="space-y-4">
              <div className="hidden md:grid md:grid-cols-2 gap-6 border-b border-slate-800 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <div>{novel.translated_language || "English"}</div>
                <div>{novel.original_language || "Original"}</div>
              </div>
              {Array.from({ length: maxPairs }).map((_, idx) => (
                <div
                  key={idx}
                  className="grid gap-3 md:grid-cols-2 md:gap-6 rounded-lg border border-slate-800/60 bg-[#121822]/60 p-4"
                >
                  <p className="text-slate-100">{translatedParas[idx] ?? ""}</p>
                  <p className="text-slate-400 border-t border-slate-800 pt-2 md:border-t-0 md:border-l md:pt-0 md:pl-6">
                    {originalParas[idx] ?? ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <nav className="mt-12 flex items-center justify-between gap-3 border-t border-slate-800 pt-6">
          {neighbors?.prev != null ? (
            <Link
              to="/novel/$slug/chapter/$number"
              params={{ slug, number: String(neighbors.prev) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#121822] px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" /> Prev (Ch. {neighbors.prev})
            </Link>
          ) : (
            <span />
          )}

          <Link
            to="/novel/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            <List className="h-4 w-4" /> Chapters
          </Link>

          {neighbors?.next != null ? (
            <Link
              to="/novel/$slug/chapter/$number"
              params={{ slug, number: String(neighbors.next) }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Next (Ch. {neighbors.next}) <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
        <Comments chapterId={chapter.id} />
      </main>
    </div>
  );
}