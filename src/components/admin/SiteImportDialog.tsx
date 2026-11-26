import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cleanChapterText } from "@/lib/novels";
import { chapterKey, classifyNovels, mapNovelRow, parseCsv, resolveChapters, type NovelImport } from "@/lib/migration-csv";

type Mode = "skip" | "update";

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = []; const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

export function SiteImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("skip");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [report, setReport] = useState<string[]>([]);
  // old novel id (from source site) -> id on this site
  const [idMap, setIdMap] = useState<Map<string, string>>(new Map());

  const run = async (fn: () => Promise<string[]>) => {
    setBusy(true); setReport([]);
    try { const r = await fn(); setReport(r); toast.success("Import finished"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
    finally {
      setBusy(false); setProgress(null);
      queryClient.invalidateQueries();
    }
  };

  const importNovels = (file: File) => run(async () => {
    setProgress("Reading file...");
    const rows = parseCsv(await file.text());
    const mapped = rows.map(mapNovelRow);
    const valid = mapped.filter((n): n is NovelImport => n !== null);
    if (!valid.length) throw new Error("No novels to import: the file needs a title column with at least one non-empty title.");
    const existing = await fetchAll<{ id: string; slug: string }>((a, b) => supabase.from("novels").select("id, slug").range(a, b));
    const { fresh, duplicates, inFileDuplicates } = classifyNovels(valid, existing);
    const nextMap = new Map(idMap);
    // A provided id may clash with a different existing row only via slug match (handled as duplicate); safe to keep.
    for (let i = 0; i < fresh.length; i += 50) {
      setProgress(`Adding novels ${i + 1}–${Math.min(i + 50, fresh.length)} of ${fresh.length}...`);
      const { data, error } = await supabase.from("novels").insert(fresh.slice(i, i + 50)).select("id, slug");
      if (error) throw new Error(error.message);
      for (const d of data ?? []) {
        const src = fresh.find((f) => f.slug === d.slug);
        if (src?.id) nextMap.set(src.id, d.id);
      }
    }
    let updated = 0;
    for (const d of duplicates) {
      if (d.id) nextMap.set(d.id, d.existingId);
      if (mode === "update") {
        setProgress(`Updating existing novels ${++updated} of ${duplicates.length}...`);
        const { id: _old, existingId, ...fields } = d;
        const { error } = await supabase.from("novels").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", existingId);
        if (error) throw new Error(error.message);
      }
    }
    setIdMap(nextMap);
    return [
      `${rows.length} rows read`,
      `${fresh.length} new novels added`,
      `${duplicates.length} already existed — ${mode === "update" ? "updated" : "skipped"}`,
      ...(inFileDuplicates ? [`${inFileDuplicates} repeated rows in the file ignored`] : []),
      ...(rows.length - valid.length ? [`${rows.length - valid.length} rows missing a title ignored`] : []),
    ];
  });

  const importChapters = (file: File) => run(async () => {
    setProgress("Reading file...");
    const rows = parseCsv(await file.text());
    const novels = await fetchAll<{ id: string; slug: string }>((a, b) => supabase.from("novels").select("id, slug").range(a, b));
    const byId = new Map<string, string>(novels.map((n) => [n.id, n.id]));
    idMap.forEach((v, k) => byId.set(k, v));
    const bySlug = new Map(novels.map((n) => [n.slug, n.id]));
    const { matched, unmatched, invalid, inFileDuplicates } = resolveChapters(rows, { byId, bySlug }, cleanChapterText);

    setProgress("Checking for chapters already on the site...");
    const existingKeys = new Set<string>();
    const novelIds = [...new Set(matched.map((c) => c.novel_id))];
    for (const nid of novelIds) {
      const ex = await fetchAll<{ number: number }>((a, b) => supabase.from("chapters").select("number").eq("novel_id", nid).range(a, b));
      ex.forEach((c) => existingKeys.add(chapterKey(nid, c.number)));
    }
    const dupCount = matched.filter((c) => existingKeys.has(chapterKey(c.novel_id, c.number))).length;
    const toWrite = mode === "update" ? matched : matched.filter((c) => !existingKeys.has(chapterKey(c.novel_id, c.number)));

    const size = 50;
    for (let i = 0; i < toWrite.length; i += size) {
      setProgress(`Uploading chapters ${i + 1}–${Math.min(i + size, toWrite.length)} of ${toWrite.length}...`);
      const batch = toWrite.slice(i, i + size).map((c) => ({ ...c, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from("chapters").upsert(batch, { onConflict: "novel_id,number" });
      if (error) throw new Error(error.message);
    }
    return [
      `${rows.length} rows read across ${novelIds.length} novels`,
      `${matched.length - dupCount} new chapters added`,
      `${dupCount} already existed — ${mode === "update" ? "updated" : "skipped"}`,
      ...(inFileDuplicates ? [`${inFileDuplicates} repeated rows in the file ignored`] : []),
      ...(unmatched.length ? [`${unmatched.length} chapters skipped: their novel isn't on this site (import novels first)`] : []),
      ...(invalid.length ? [`${invalid.length} rows without a chapter number ignored`] : []),
    ];
  });

  const fileInput = (onFile: (f: File) => void) => (
    <Input type="file" accept=".csv" disabled={busy} className="bg-slate-900 border-slate-700 text-xs"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="bg-[#121822] border-slate-800 text-slate-100 max-w-lg">
        <DialogHeader><DialogTitle>Site import (novels & chapters)</DialogTitle></DialogHeader>
        <div className="space-y-5 text-sm">
          <div>
            <Label>When a novel or chapter already exists</Label>
            <select value={mode} disabled={busy} onChange={(e) => setMode(e.target.value as Mode)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white">
              <option value="skip">Skip it (keep what's on this site)</option>
              <option value="update">Overwrite it with the file's version</option>
            </select>
          </div>
          <div className="space-y-2">
            <p className="font-semibold">1. Novels file</p>
            <p className="text-xs text-slate-400">Required column: <code>title</code>. Optional: <code>slug</code> (generated from title when absent). Duplicate keys: id or slug.</p>
            {fileInput(importNovels)}
          </div>
          <div className="space-y-2">
            <p className="font-semibold">2. Chapters file</p>
            <p className="text-xs text-slate-400">Exported chapters table. Each row is assigned by <code>novel_id</code> (or <code>novel_slug</code>); duplicates matched by novel + chapter number. Import novels first.</p>
            {fileInput(importChapters)}
          </div>
          {progress && <p className="text-xs text-blue-300">{progress}</p>}
          {report.length > 0 && (
            <ul className="rounded-md border border-slate-800 bg-slate-900 p-3 text-xs space-y-1">
              {report.map((r) => <li key={r}>• {r}</li>)}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
