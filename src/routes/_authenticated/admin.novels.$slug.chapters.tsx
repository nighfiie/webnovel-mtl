import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, Edit3, ExternalLink, Languages, Plus, Settings2, Square, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatTextLength } from "@/lib/catalog";
import { cleanChapterText, type ChapterRecord, type NovelRecord } from "@/lib/novels";
import { parseCsv } from "@/lib/migration-csv";
import { fetchChapterContent, type ScraperEngine } from "@/lib/scraper.functions";
import { ContentPlacementSelect } from "@/components/ContentPlacementSelect";
import { placeChapterContent, type ContentPlacement } from "@/lib/chapter-language";
import { crawlDelayBefore } from "@/lib/crawl-utils";
import { collectChapterPages } from "@/lib/chapter-navigation";
import { GENRE_PRESETS, type GenrePreset } from "@/lib/translation-prompts";
import type { AiProvider } from "@/lib/ai-translate.functions";
import {
  loadLocalLlmConfig,
  saveLocalLlmConfig,
  translateChapterText,
  ENGINE_LABELS,
  loadAiSettings,
  saveAiSettings,
  type AiTranslationSettings,
  type LocalLlmConfig,
  type TranslationEngine,
} from "@/lib/translator";

export const Route = createFileRoute("/_authenticated/admin/novels/$slug/chapters")({
  head: () => ({
    meta: [
      { title: "Manage Chapters — ReadNovel Admin" },
      { name: "description", content: "Import, bulk edit, delete, and translate novel chapters." },
      { property: "og:title", content: "Manage Chapters — ReadNovel Admin" },
      { property: "og:description", content: "Import, bulk edit, delete, and translate novel chapters." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminChaptersPage,
});

function AdminChaptersPage() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "translated" | "untranslated">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  // Add Chapter Modal
  const [addOpen, setAddOpen] = useState(false);
  const [newNum, setNewNum] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newOriginal, setNewOriginal] = useState("");

  // Importer Modal
  const [placement, setPlacement] = useState<ContentPlacement>("auto");
  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState<"url" | "crawl" | "csv">("url");
  const [crawlStartUrl, setCrawlStartUrl] = useState("");
  const [crawlMax, setCrawlMax] = useState("50");
  const [crawlDelay, setCrawlDelay] = useState("2.5");
  const [crawlPauseEvery, setCrawlPauseEvery] = useState("10");
  const [crawlPauseSecs, setCrawlPauseSecs] = useState("10");
  const [crawlNextText, setCrawlNextText] = useState("");
  const [crawlRemove, setCrawlRemove] = useState("");
  const crawlAbortRef = useRef(false);
  const [scraperEngine, setScraperEngine] = useState<ScraperEngine>("fallback");
  const [firecrawlKey, setFirecrawlKey] = useState("");
  const [importUrls, setImportUrls] = useState("");
  const [startChapterNum, setStartChapterNum] = useState("1");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<string | null>(null);

  // Translation & LM Studio Settings
  const [translateEngine, setTranslateEngine] = useState<TranslationEngine>("google");
  const [llmOpen, setLlmOpen] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LocalLlmConfig>(() => loadLocalLlmConfig());
  const [aiSettings, setAiSettings] = useState<AiTranslationSettings>(() => loadAiSettings());
  const [bulkTranslating, setBulkTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: novel } = useQuery({
    queryKey: ["novel", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("novels").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as NovelRecord | null;
    },
  });

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ["admin-chapters", novel?.id],
    enabled: Boolean(novel?.id),
    queryFn: async () => {
      return collectChapterPages(async (from, to) => {
      const { data, error } = await supabase
        .from("chapters")
        .select("id, novel_id, number, title, content_translated, content_original, source_url, created_at, updated_at")
        .eq("novel_id", novel?.id ?? "")
        .order("number", { ascending: true })
        .range(from, to);
      if (error) throw error;
      return (data ?? []) as ChapterRecord[];
      }, 100);
    },
  });

  const addChapterMutation = useMutation({
    mutationFn: async () => {
      if (!novel) throw new Error("Novel not loaded");
      const num = Number(newNum || (chapters.length ? Math.max(...chapters.map((c) => Number(c.number))) + 1 : 1));
      const { error } = await supabase.from("chapters").insert({
        novel_id: novel.id,
        number: num,
        title: newTitle.trim() || `Chapter ${num}`,
        content_original: newOriginal.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chapter added");
      setAddOpen(false);
      setNewNum("");
      setNewTitle("");
      setNewOriginal("");
      queryClient.invalidateQueries({ queryKey: ["admin-chapters", novel?.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add chapter"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("chapters").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted selected chapter(s)");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["admin-chapters", novel?.id] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
  });

  const handleUrlImport = async () => {
    if (!novel) return;
    const urls = importUrls
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http://") || u.startsWith("https://"));
    if (urls.length === 0) {
      toast.error("Paste at least one valid http(s) URL (one per line)");
      return;
    }

    setImporting(true);
    let currentNum = Number(startChapterNum) || 1;
    let successCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (!url) continue;
      setImportProgress(`Fetching ${i + 1} / ${urls.length}...`);
      try {
        const scraped = await fetchChapterContent({
          data: {
            url,
            engine: scraperEngine,
            ...(firecrawlKey.trim() ? { firecrawlApiKey: firecrawlKey.trim() } : {}),
          },
        });
        const { error } = await supabase.from("chapters").upsert(
          {
            novel_id: novel.id,
            number: currentNum,
            title: scraped.title || `Chapter ${currentNum}`,
            ...placeChapterContent(scraped.content, placement, novel.original_language, novel.translated_language, novel.language_mode),
            source_url: url,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "novel_id,number" },
        );
        if (error) throw error;
        successCount++;
        currentNum++;
      } catch (err) {
        toast.error(`Failed URL #${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    setImporting(false);
    setImportProgress(null);
    if (successCount > 0) {
      toast.success(`Imported ${successCount} chapter(s)`);
      queryClient.invalidateQueries({ queryKey: ["admin-chapters", novel.id] });
      setImportOpen(false);
      setImportUrls("");
    }
  };

  const handleAutoCrawl = async () => {
    if (!novel) return;
    let url: string | null = crawlStartUrl.trim();
    if (!url.startsWith("http")) {
      toast.error("Enter the URL of the first chapter to crawl");
      return;
    }
    const max = Math.max(1, Number(crawlMax) || 1);
    const delayMs = Math.max(0, Number(crawlDelay) || 0) * 1000;
    const pauseEvery = Math.max(0, Number(crawlPauseEvery) || 0);
    const pauseMs = Math.max(0, Number(crawlPauseSecs) || 0) * 1000;
    const removePhrases = crawlRemove.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const seen = new Set<string>();
    crawlAbortRef.current = false;
    setImporting(true);
    let num = Number(startChapterNum) || 1;
    let ok = 0;
    for (let i = 0; i < max && url; i++) {
      if (crawlAbortRef.current) break;
      if (seen.has(url)) break;
      seen.add(url);
      const wait = crawlDelayBefore(i, delayMs, pauseEvery, pauseMs);
      if (wait > 0) {
        setImportProgress(`Waiting ${(wait / 1000).toFixed(1)}s before chapter ${i + 1}...`);
        await new Promise((r) => setTimeout(r, wait));
        if (crawlAbortRef.current) break;
      }
      setImportProgress(`Crawling chapter ${i + 1} / ${max} (Ch. ${num})...`);
      let scraped: Awaited<ReturnType<typeof fetchChapterContent>> | null = null;
      for (let attempt = 0; attempt < 2 && !scraped; attempt++) {
        try {
          scraped = await fetchChapterContent({
            data: {
              url,
              engine: scraperEngine,
              ...(firecrawlKey.trim() ? { firecrawlApiKey: firecrawlKey.trim() } : {}),
              ...(crawlNextText.trim() ? { nextLinkText: crawlNextText.trim() } : {}),
              removePhrases,
            },
          });
        } catch (err) {
          if (attempt === 1) toast.error(`Stopped at ${url}: ${err instanceof Error ? err.message : "error"}`);
          else await new Promise((r) => setTimeout(r, Math.max(delayMs, 3000)));
        }
      }
      if (!scraped) break;
      let contentFields: ReturnType<typeof placeChapterContent>;
      try {
        contentFields = placeChapterContent(scraped.content, placement, novel.original_language, novel.translated_language, novel.language_mode);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Language detection failed");
        break;
      }
      const { error } = await supabase.from("chapters").upsert(
        {
          novel_id: novel.id,
          number: num,
          title: scraped.title || `Chapter ${num}`,
          ...contentFields,
          source_url: url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "novel_id,number" },
      );
      if (error) {
        toast.error(error.message);
        break;
      }
      ok++;
      num++;
      url = scraped.nextUrl;
      if (!url) toast.info("No next-chapter link found — crawl finished.");
    }
    setImporting(false);
    setImportProgress(null);
    if (ok > 0) {
      toast.success(`Crawled ${ok} chapter(s)`);
      setStartChapterNum(String(num));
      queryClient.invalidateQueries({ queryKey: ["admin-chapters", novel.id] });
    }
  };

  const handleCsvUpload = async (file: File) => {
    if (!novel) return;
    setImporting(true);
    setImportProgress("Parsing CSV...");
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error("No valid rows found in CSV");

      const batchSize = 50;
      let imported = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        setImportProgress(`Uploading chapters ${i + 1}–${Math.min(i + batchSize, rows.length)} of ${rows.length}...`);
        const batch = rows.slice(i, i + batchSize).map((r) => ({
          novel_id: novel.id,
          number: Number(r["number"] || 0),
          title: (r["title"] || `Chapter ${r["number"]}`).trim(),
          content_original: r["content_original"] ? cleanChapterText(r["content_original"]) : null,
          content_translated: r["content_translated"]?.trim() || null,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from("chapters").upsert(batch, { onConflict: "novel_id,number" });
        if (error) throw error;
        imported += batch.length;
      }
      toast.success(`Imported ${imported} chapters from CSV`);
      queryClient.invalidateQueries({ queryKey: ["admin-chapters", novel.id] });
      setImportOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleBulkTranslate = async () => {
    const targets = chapters.filter((c) => selectedIds.includes(c.id));
    if (targets.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setBulkTranslating(true);
    let done = 0;

    for (let i = 0; i < targets.length; i++) {
      if (controller.signal.aborted) break;
      const ch = targets[i];
      if (!ch?.content_original?.trim()) continue;
      const originalText = ch.content_original;
      setTranslateProgress(`Translating Ch. ${ch.number} (${i + 1} / ${targets.length})...`);
      try {
        const run = () =>
          translateChapterText({
            text: originalText,
            engine: translateEngine,
            localLlmConfig: llmConfig,
            aiSettings,
            signal: controller.signal,
          });
        let translated: string;
        try {
          translated = await run();
        } catch {
          if (controller.signal.aborted) break;
          setTranslateProgress(`Retrying Ch. ${ch.number}...`);
          await new Promise((r) => setTimeout(r, 3000));
          translated = await run();
        }
        let newTitle = ch.title;
        if (ch.title?.trim()) {
          try {
            const t = await translateChapterText({ text: ch.title, engine: translateEngine, localLlmConfig: llmConfig, aiSettings, signal: controller.signal });
            if (t.trim()) newTitle = t.trim().split("\n")[0]!.trim();
          } catch { /* keep original title */ }
        }
        const { error } = await supabase
          .from("chapters")
          .update({ title: newTitle, content_translated: translated, updated_at: new Date().toISOString() })
          .eq("id", ch.id);
        if (error) throw error;
        done++;
      } catch (err) {
        if (controller.signal.aborted) break;
        toast.error(`Ch. ${ch.number} failed: ${err instanceof Error ? err.message : "Translation error"}`);
        break;
      }
    }

    setBulkTranslating(false);
    setTranslateProgress(null);
    abortRef.current = null;
    if (done > 0) {
      toast.success(`Translated ${done} chapter(s)`);
      queryClient.invalidateQueries({ queryKey: ["admin-chapters", novel?.id] });
    }
  };

  const filtered = chapters.filter((c) => {
    if (filter === "translated" && !c.content_translated) return false;
    if (filter === "untranslated" && c.content_translated) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.title.toLowerCase().includes(q) || String(c.number).includes(q);
    }
    return true;
  });

  const PAGE_SIZE = 100;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const allSelected = visible.length > 0 && visible.every((c) => selectedIds.includes(c.id));

  return (
    <div className="min-h-screen bg-[#0c1017] text-slate-100">
      <header className="border-b border-slate-800 bg-[#121822]">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 max-w-6xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Novels
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-sm font-medium text-white truncate max-w-xs">{novel?.title ?? slug}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setLlmOpen(true)} className="border-slate-700 gap-1.5 text-xs">
              <Settings2 className="h-3.5 w-3.5" /> LM Studio Settings
            </Button>
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)} className="border-slate-700 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Import Chapters
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add Chapter
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => (setSearch(e.target.value), setPage(0))}
              placeholder="Search chapter # or title..."
              className="w-56 bg-slate-900 border-slate-700 text-sm"
            />
            <div className="inline-flex rounded-lg border border-slate-800 bg-[#121822] p-0.5 text-xs">
              {(["all", "translated", "untranslated"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-2.5 py-1 capitalize ${
                    filter === f ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-slate-400">
            Showing {visible.length ? safePage * PAGE_SIZE + 1 : 0}–{safePage * PAGE_SIZE + visible.length} of {filtered.length} ({chapters.length} total)
            {pageCount > 1 && (
              <span className="ml-3 inline-flex items-center gap-1">
                <button type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} className="rounded border border-slate-700 px-2 py-0.5 disabled:opacity-40">Prev</button>
                <select aria-label="Chapter range" value={safePage} onChange={(e) => setPage(Number(e.target.value))} className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-white">
                  {Array.from({ length: pageCount }, (_, i) => {
                    const a = filtered[i * PAGE_SIZE]?.number; const b = filtered[Math.min(filtered.length, (i + 1) * PAGE_SIZE) - 1]?.number;
                    return <option key={i} value={i}>Ch. {a}–{b}</option>;
                  })}
                </select>
                <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} className="rounded border border-slate-700 px-2 py-0.5 disabled:opacity-40">Next</button>
              </span>
            )}
          </div>
        </div>

        {/* Bulk Actions + Bulk Translate Bar */}
        {(selectedIds.length > 0 || bulkTranslating) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-blue-200">{selectedIds.length} selected</span>
              <select
                value={translateEngine}
                onChange={(e) => setTranslateEngine(e.target.value as TranslationEngine)}
                disabled={bulkTranslating}
                className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white"
              >
                {(Object.keys(ENGINE_LABELS) as TranslationEngine[]).map((k) => (
                  <option key={k} value={k}>{ENGINE_LABELS[k]}</option>
                ))}
              </select>

              {bulkTranslating ? (
                <Button size="sm" variant="destructive" onClick={() => abortRef.current?.abort()} className="h-7 gap-1 text-xs">
                  <Square className="h-3 w-3" /> Stop ({translateProgress})
                </Button>
              ) : (
                <Button size="sm" onClick={handleBulkTranslate} className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs">
                  <Languages className="h-3.5 w-3.5" /> Bulk Translate
                </Button>
              )}
            </div>

            <Button
              size="sm"
              variant="destructive"
              disabled={bulkTranslating}
              className="h-7 text-xs gap-1"
              onClick={() => {
                if (window.confirm(`Delete ${selectedIds.length} selected chapter(s)?`)) {
                  deleteMutation.mutate(selectedIds);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Bulk Delete
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#121822]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/60 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setSelectedIds(e.target.checked ? [...new Set([...selectedIds, ...visible.map((c) => c.id)])] : selectedIds.filter((id) => !visible.some((c) => c.id === id)))}
                  />
                </th>
                <th className="p-3 w-20">#</th>
                <th className="p-3">Title</th>
                <th className="p-3">Translation</th>
                <th className="p-3">Length</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {isLoading ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">Loading chapters...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">No chapters found.</td></tr>
              ) : (
                visible.map((ch) => (
                  <tr key={ch.id} className="hover:bg-slate-900/40">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(ch.id)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked ? [...prev, ch.id] : prev.filter((id) => id !== ch.id),
                          )
                        }
                      />
                    </td>
                    <td className="p-3 tabular-nums text-slate-300">{ch.number}</td>
                    <td className="p-3 font-medium text-white">{ch.title}</td>
                    <td className="p-3">
                      {ch.content_translated ? (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">Translated</span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Original only</span>
                      )}
                    </td>
                    <td className="p-3 text-xs tabular-nums text-slate-400">
                      {ch.content_original && <div>Orig: {formatTextLength(ch.content_original)}</div>}
                      {ch.content_translated && <div>Trans: {formatTextLength(ch.content_translated)}</div>}
                      {!ch.content_original && !ch.content_translated && <span className="text-red-400">Empty</span>}
                    </td>
                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          to="/admin/novels/$slug/chapters/$chapterId"
                          params={{ slug, chapterId: ch.id }}
                          className="inline-flex items-center gap-1 rounded-md bg-blue-600/20 px-2.5 py-1 text-xs font-medium text-blue-300 hover:bg-blue-600/30"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit / Fetch / Translate
                        </Link>
                        <Link
                          to="/novel/$slug/chapter/$number"
                          params={{ slug, number: String(ch.number) }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          title="Read chapter"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete Chapter ${ch.number}?`)) {
                              deleteMutation.mutate([ch.id]);
                            }
                          }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-950 hover:text-red-400"
                          title="Delete chapter"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add Chapter Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-[#121822] border-slate-800 text-slate-100">
          <DialogHeader><DialogTitle>Add Chapter</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addChapterMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <div>
                <Label>Number</Label>
                <Input
                  type="number"
                  step="any"
                  value={newNum}
                  onChange={(e) => setNewNum(e.target.value)}
                  placeholder={String(chapters.length + 1)}
                  className="mt-1 bg-slate-900 border-slate-700"
                />
              </div>
              <div>
                <Label>Title</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="mt-1 bg-slate-900 border-slate-700" required />
              </div>
            </div>
            <div>
              <Label>Original Content</Label>
              <Textarea value={newOriginal} onChange={(e) => setNewOriginal(e.target.value)} rows={8} className="mt-1 bg-slate-900 border-slate-700" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="border-slate-700">Cancel</Button>
              <Button type="submit" disabled={addChapterMutation.isPending} className="bg-blue-600 hover:bg-blue-500 text-white">Add Chapter</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Chapter Importer Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl bg-[#121822] border-slate-800 text-slate-100">
          <DialogHeader><DialogTitle>Chapter Importer</DialogTitle></DialogHeader>
          <div className="flex gap-2 border-b border-slate-800 pb-3 text-xs">
            <button
              type="button"
              onClick={() => setImportTab("url")}
              className={`rounded-md px-3 py-1.5 font-medium ${importTab === "url" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"}`}
            >
              Fetch from URL(s)
            </button>
            <button
              type="button"
              onClick={() => setImportTab("crawl")}
              className={`rounded-md px-3 py-1.5 font-medium ${importTab === "crawl" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"}`}
            >
              Auto-Crawl
            </button>
            <button
              type="button"
              onClick={() => setImportTab("csv")}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-medium ${importTab === "csv" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"}`}
            >
              <Upload className="h-3.5 w-3.5" /> Import CSV Export
            </button>
          </div>

          {importTab !== "csv" && <ContentPlacementSelect value={placement} onChange={setPlacement} disabled={importing} />}

          {importTab === "crawl" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Starts at the first chapter and keeps following the &quot;Next Chapter&quot; link until it reaches the limit or the last chapter.
              </p>
              <div>
                <Label>First chapter URL</Label>
                <Input value={crawlStartUrl} onChange={(e) => setCrawlStartUrl(e.target.value)} placeholder="https://example.com/novel/chapter-1" className="mt-1 bg-slate-900 border-slate-700" />
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
                <div>
                  <Label>Crawler Engine</Label>
                  <select value={scraperEngine} onChange={(e) => setScraperEngine(e.target.value as ScraperEngine)} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
                    <option value="fallback">Built-in</option>
                    <option value="firecrawl">Firecrawl</option>
                  </select>
                </div>
                <div><Label>Start at Ch. #</Label><Input type="number" value={startChapterNum} onChange={(e) => setStartChapterNum(e.target.value)} className="mt-1 bg-slate-900 border-slate-700" /></div>
                <div><Label>Max chapters</Label><Input type="number" value={crawlMax} onChange={(e) => setCrawlMax(e.target.value)} className="mt-1 bg-slate-900 border-slate-700" /></div>
                <div><Label>Delay (seconds)</Label><Input type="number" step="0.5" value={crawlDelay} onChange={(e) => setCrawlDelay(e.target.value)} className="mt-1 bg-slate-900 border-slate-700" /></div>
                <div><Label>Long pause every</Label><Input type="number" value={crawlPauseEvery} onChange={(e) => setCrawlPauseEvery(e.target.value)} className="mt-1 bg-slate-900 border-slate-700" /></div>
                <div><Label>Long pause (sec)</Label><Input type="number" value={crawlPauseSecs} onChange={(e) => setCrawlPauseSecs(e.target.value)} className="mt-1 bg-slate-900 border-slate-700" /></div>
              </div>
              {scraperEngine === "firecrawl" && (
                <div><Label>Firecrawl API Key (optional)</Label><Input type="password" value={firecrawlKey} onChange={(e) => setFirecrawlKey(e.target.value)} placeholder="fc-..." className="mt-1 bg-slate-900 border-slate-700" /></div>
              )}
              <div>
                <Label>&quot;Next&quot; button text (optional, auto-detected if empty)</Label>
                <Input value={crawlNextText} onChange={(e) => setCrawlNextText(e.target.value)} placeholder="下一章 / Next Chapter" className="mt-1 bg-slate-900 border-slate-700" />
              </div>
              <div>
                <Label>Remove lines containing (one per line: ads, watermarks, notes)</Label>
                <Textarea value={crawlRemove} onChange={(e) => setCrawlRemove(e.target.value)} rows={3} className="mt-1 bg-slate-900 border-slate-700 font-mono text-xs" />
              </div>
              {importProgress && <p className="text-xs text-blue-300">{importProgress}</p>}
              <div className="flex justify-end gap-2">
                {importing ? (
                  <Button type="button" variant="outline" onClick={() => { crawlAbortRef.current = true; }} className="border-slate-700">Stop</Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => setImportOpen(false)} className="border-slate-700">Close</Button>
                )}
                <Button type="button" disabled={importing} onClick={handleAutoCrawl} className="bg-blue-600 hover:bg-blue-500 text-white">
                  {importing ? "Crawling..." : "Start Crawl"}
                </Button>
              </div>
            </div>
          ) : importTab === "url" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Crawler Engine</Label>
                  <select
                    value={scraperEngine}
                    onChange={(e) => setScraperEngine(e.target.value as ScraperEngine)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  >
                    <option value="fallback">Built-in Fallback (No 3rd-party)</option>
                    <option value="firecrawl">Firecrawl Service</option>
                  </select>
                </div>
                <div>
                  <Label>Starting Chapter #</Label>
                  <Input
                    type="number"
                    value={startChapterNum}
                    onChange={(e) => setStartChapterNum(e.target.value)}
                    className="mt-1 bg-slate-900 border-slate-700"
                  />
                </div>
              </div>

              {scraperEngine === "firecrawl" && (
                <div>
                  <Label>Firecrawl API Key (optional if configured on server)</Label>
                  <Input
                    type="password"
                    value={firecrawlKey}
                    onChange={(e) => setFirecrawlKey(e.target.value)}
                    placeholder="fc-..."
                    className="mt-1 bg-slate-900 border-slate-700"
                  />
                </div>
              )}

              <div>
                <Label>Chapter URLs (one URL per line for single or bulk import)</Label>
                <Textarea
                  value={importUrls}
                  onChange={(e) => setImportUrls(e.target.value)}
                  rows={6}
                  placeholder={"https://example.com/chapter-1\nhttps://example.com/chapter-2"}
                  className="mt-1 bg-slate-900 border-slate-700 font-mono text-xs"
                />
              </div>

              {importProgress && <p className="text-xs text-blue-300">{importProgress}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setImportOpen(false)} className="border-slate-700">Cancel</Button>
                <Button type="button" disabled={importing} onClick={handleUrlImport} className="bg-blue-600 hover:bg-blue-500 text-white">
                  {importing ? "Importing..." : "Start Import"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Chapters CSV: comma or semicolon delimiters, with quoted multiline content.
              </p>
              <Input
                type="file"
                accept=".csv"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvUpload(file);
                }}
                className="bg-slate-900 border-slate-700 text-xs"
              />
              {importProgress && <p className="text-xs text-blue-300">{importProgress}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* LM Studio Local LLM Settings Modal */}
      <Dialog open={llmOpen} onOpenChange={setLlmOpen}>
        <DialogContent className="bg-[#121822] border-slate-800 text-slate-100">
          <DialogHeader><DialogTitle>Translation Settings</DialogTitle></DialogHeader>
          <div className="space-y-3 border-b border-slate-800 pb-4 max-h-[45vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Novel style</Label>
                <select value={aiSettings.genre} onChange={(e) => setAiSettings((s) => ({ ...s, genre: e.target.value as GenrePreset }))} className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
                  {(Object.keys(GENRE_PRESETS) as GenrePreset[]).map((g) => <option key={g} value={g}>{GENRE_PRESETS[g].label}</option>)}
                </select>
              </div>
              <div>
                <Label>Translate into</Label>
                <Input value={aiSettings.targetLanguage} onChange={(e) => setAiSettings((s) => ({ ...s, targetLanguage: e.target.value }))} className="mt-1 bg-slate-900 border-slate-700" />
              </div>
            </div>
            <div>
              <Label>Glossary (one per line: original = translation)</Label>
              <Textarea value={aiSettings.glossary} onChange={(e) => setAiSettings((s) => ({ ...s, glossary: e.target.value }))} rows={3} placeholder={"林动 = Lin Dong\n筑基 = Foundation Establishment"} className="mt-1 bg-slate-900 border-slate-700 font-mono text-xs" />
            </div>
            <div>
              <Label>Extra instructions (optional)</Label>
              <Textarea value={aiSettings.customInstructions} onChange={(e) => setAiSettings((s) => ({ ...s, customInstructions: e.target.value }))} rows={2} className="mt-1 bg-slate-900 border-slate-700 text-xs" />
            </div>
            <p className="text-xs text-slate-400">Your own provider keys are saved only in this browser.</p>
            {(["deepl", "openai", "anthropic", "gemini", "deepseek", "groq", "openrouter"] as AiProvider[]).map((p) => (
              <div key={p} className="grid grid-cols-2 gap-2">
                <Input type="password" value={aiSettings.keys[p] ?? ""} onChange={(e) => setAiSettings((s) => ({ ...s, keys: { ...s.keys, [p]: e.target.value } }))} placeholder={`${ENGINE_LABELS[p].replace(" (your key)", "")} API key`} className="bg-slate-900 border-slate-700 text-xs" />
                {p !== "deepl" && (
                  <Input value={aiSettings.models[p] ?? ""} onChange={(e) => setAiSettings((s) => ({ ...s, models: { ...s.models, [p]: e.target.value } }))} placeholder="Model (optional)" className="bg-slate-900 border-slate-700 text-xs" />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-slate-300">Local LLM (LM Studio / Ollama)</p>
          <div className="space-y-4">
            <p className="text-xs text-slate-400">
              Requests are sent directly from your browser to your local server. Make sure <strong>Enable CORS</strong> is turned on in LM Studio&apos;s Server settings.
            </p>
            <div>
              <Label>Base URL</Label>
              <Input
                value={llmConfig.baseUrl}
                onChange={(e) => setLlmConfig((c) => ({ ...c, baseUrl: e.target.value }))}
                placeholder="http://localhost:1234/v1"
                className="mt-1 bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <Label>Model Name</Label>
              <Input
                value={llmConfig.model}
                onChange={(e) => setLlmConfig((c) => ({ ...c, model: e.target.value }))}
                placeholder="qwen2.5-7b-instruct"
                className="mt-1 bg-slate-900 border-slate-700"
              />
            </div>
            <div>
              <Label>System Prompt</Label>
              <Textarea
                value={llmConfig.systemPrompt}
                onChange={(e) => setLlmConfig((c) => ({ ...c, systemPrompt: e.target.value }))}
                rows={4}
                className="mt-1 bg-slate-900 border-slate-700 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setLlmOpen(false)} className="border-slate-700">Cancel</Button>
              <Button
                type="button"
                onClick={() => {
                  saveLocalLlmConfig(llmConfig);
                  saveAiSettings(aiSettings);
                  toast.success("Translation settings saved");
                  setLlmOpen(false);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                Save Settings
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}