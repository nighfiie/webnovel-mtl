import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, ExternalLink, Languages, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { ChapterRecord, NovelRecord } from "@/lib/novels";
import { ContentPlacementSelect } from "@/components/ContentPlacementSelect";
import { placeChapterContent, type ContentPlacement } from "@/lib/chapter-language";
import { fetchChapterContent, type ScraperEngine } from "@/lib/scraper.functions";
import { useSelectorProfiles, SelectorProfiles } from "@/components/admin/SelectorProfiles";
import { matchProfile } from "@/lib/scraper-profiles";
import { stitchChapterPages } from "@/lib/chapter-stitching";
import { translateChapterText, type TranslationEngine } from "@/lib/translator";

export const Route = createFileRoute("/_authenticated/admin/novels/$slug/chapters_/$chapterId")({
  head: () => ({
    meta: [
      { title: "Edit Chapter — ReadNovel Admin" },
      { name: "description", content: "Edit, fetch, and translate a single chapter." },
      { property: "og:title", content: "Edit Chapter — ReadNovel Admin" },
      { property: "og:description", content: "Edit, fetch, and translate a single chapter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminEditChapterPage,
});

function AdminEditChapterPage() {
  const { slug, chapterId } = Route.useParams();
  const queryClient = useQueryClient();

  const [number, setNumber] = useState("1");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [contentOriginal, setContentOriginal] = useState("");
  const [contentTranslated, setContentTranslated] = useState("");

  const [scraperEngine, setScraperEngine] = useState<ScraperEngine>("fallback");
  const [translateEngine, setTranslateEngine] = useState<TranslationEngine>("google");
  const [placement, setPlacement] = useState<ContentPlacement>("auto");
  const profileSettings = useSelectorProfiles();
  const [stitchPages, setStitchPages] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [translating, setTranslating] = useState(false);

  const { data: novel } = useQuery({
    queryKey: ["novel", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("novels").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as NovelRecord | null;
    },
  });

  const { data: chapter, isLoading } = useQuery({
    queryKey: ["admin-chapter", chapterId],
    queryFn: async () => {
      const { data, error } = await supabase.from("chapters").select("*").eq("id", chapterId).maybeSingle();
      if (error) throw error;
      return data as ChapterRecord | null;
    },
  });

  useEffect(() => {
    if (chapter) {
      setNumber(String(chapter.number));
      setTitle(chapter.title);
      setSourceUrl(chapter.source_url ?? "");
      setContentOriginal(chapter.content_original ?? "");
      setContentTranslated(chapter.content_translated ?? "");
    }
  }, [chapter]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const num = Number(number);
      if (!Number.isFinite(num)) throw new Error("Invalid chapter number");
      const { error } = await supabase
        .from("chapters")
        .update({
          number: num,
          title: title.trim() || `Chapter ${num}`,
          source_url: sourceUrl.trim() || null,
          content_original: contentOriginal || null,
          content_translated: contentTranslated || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", chapterId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chapter saved");
      queryClient.invalidateQueries({ queryKey: ["admin-chapter", chapterId] });
      queryClient.invalidateQueries({ queryKey: ["admin-chapters", novel?.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save chapter"),
  });

  const handleSingleFetch = async () => {
    if (!sourceUrl.trim()) {
      toast.error("Enter a Source URL first");
      return;
    }
    setFetching(true);
    try {
      const res = await stitchChapterPages(sourceUrl.trim(), async url => {
        const profile = matchProfile(url, profileSettings.profiles);
        return fetchChapterContent({ data: { url, engine: scraperEngine, ...(profile ? { profile } : {}) } });
      }, { enabled: stitchPages, delayMs: 2500 });
      const fields = placeChapterContent(res.content, placement, novel?.original_language, novel?.translated_language, novel?.language_mode);
      if (fields.content_original) setContentOriginal(fields.content_original);
      if (fields.content_translated) setContentTranslated(fields.content_translated);
      if (!title.trim() || title.startsWith("Chapter ")) {
        setTitle(res.title);
      }
      toast.success(`Fetched ${fields.content_original && fields.content_translated ? "both languages" : fields.content_translated ? "translated text" : "original text"}. Save to keep changes.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setFetching(false);
    }
  };

  const handleSingleTranslate = async () => {
    if (!contentOriginal.trim()) {
      toast.error("No original text to translate");
      return;
    }
    setTranslating(true);
    try {
      const translated = await translateChapterText({
        text: contentOriginal,
        engine: translateEngine,
      });
      setContentTranslated(translated);
      if (title.trim()) {
        try {
          const t = await translateChapterText({ text: title, engine: translateEngine });
          if (t.trim()) setTitle(t.trim().split("\n")[0]?.trim() || title);
        } catch { /* keep original title */ }
      }
      toast.success(
        translateEngine === "google"
          ? "Translated with Google Translate (0 credits)"
          : "Translated with LM Studio",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Translation failed");
    } finally {
      setTranslating(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#0c1017] text-slate-300 flex items-center justify-center">Loading chapter...</div>;
  }

  if (!chapter) {
    return <div className="min-h-screen bg-[#0c1017] text-slate-300 flex items-center justify-center">Chapter not found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-[#121822]">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 max-w-6xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/novels/$slug/chapters"
              params={{ slug }}
              className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" /> Chapters
            </Link>
            <span className="text-sm text-slate-500">/</span>
            <span className="text-sm font-medium text-white truncate max-w-xs">
              Edit Ch. {number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/novel/$slug/chapter/$number"
              params={{ slug, number }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Reader View
            </Link>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
            >
              <Save className="h-4 w-4" /> {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <div>
            <Label>Chapter #</Label>
            <Input
              type="number"
              step="any"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="mt-1 bg-slate-900 border-slate-700"
            />
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 bg-slate-900 border-slate-700"
            />
          </div>
        </div>

        {/* Single Fetch & Single Translate Toolbar */}
        <div className="grid gap-4 rounded-xl border border-slate-800 bg-[#121822] p-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-slate-400">Single Chapter Fetch</Label>
            <ContentPlacementSelect value={placement} onChange={setPlacement} disabled={fetching} />
            <div className="admin-tools-shell"><SelectorProfiles {...profileSettings} disabled={fetching}/></div>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={stitchPages} disabled={fetching} onChange={e => setStitchPages(e.target.checked)}/>Merge continuation pages</label>
            <div className="flex flex-wrap gap-2">
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://source-site.com/chapter-1"
                className="flex-1 min-w-[180px] bg-slate-900 border-slate-700 text-xs"
              />
              <select
                value={scraperEngine}
                onChange={(e) => setScraperEngine(e.target.value as ScraperEngine)}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
              >
                <option value="fallback">Built-in Fallback</option>
                <option value="firecrawl">Firecrawl</option>
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={fetching}
                onClick={handleSingleFetch}
                className="border-slate-700 gap-1.5"
              >
                <Download className="h-3.5 w-3.5" /> {fetching ? "Fetching..." : "Fetch"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-slate-400">Single Chapter Translate</Label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={translateEngine}
                onChange={(e) => setTranslateEngine(e.target.value as TranslationEngine)}
                className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-2 text-xs text-white"
              >
                <option value="google">Google Translate (Free, 0 credits)</option>
                <option value="lmstudio">LM Studio / Local LLM (Browser CORS)</option>
              </select>
              <Button
                type="button"
                size="sm"
                disabled={translating}
                onClick={handleSingleTranslate}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
              >
                <Languages className="h-3.5 w-3.5" /> {translating ? "Translating..." : "Translate"}
              </Button>
            </div>
          </div>
        </div>

        {/* Side-by-side Editors */}
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <Label className="mb-1.5 block text-slate-300">
              Original Text ({novel?.original_language || "Original"})
            </Label>
            <Textarea
              value={contentOriginal}
              onChange={(e) => setContentOriginal(e.target.value)}
              rows={22}
              className="bg-slate-900 border-slate-700 font-sans text-sm leading-relaxed"
              placeholder="Paste or fetch original chapter text here..."
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-slate-300">
              Translated Text ({novel?.translated_language || "English"})
            </Label>
            <Textarea
              value={contentTranslated}
              onChange={(e) => setContentTranslated(e.target.value)}
              rows={22}
              className="bg-slate-900 border-slate-700 font-sans text-sm leading-relaxed"
              placeholder="Translated text will appear here..."
            />
          </div>
        </div>
      </main>
    </div>
  );
}