import type { NovelRecord } from "./novels";

export type TriState = "include" | "exclude";
export type SortKey = "recent" | "popular" | "rating" | "title";

export interface CatalogFilters {
  query: string;
  genres: Record<string, TriState>;
  status: string; // "" = any
  sort: SortKey;
  ascending: boolean;
}

export function cycleTriState(current: TriState | undefined): TriState | undefined {
  if (!current) return "include";
  if (current === "include") return "exclude";
  return undefined;
}

type CatalogNovel = Pick<
  NovelRecord,
  "title" | "original_title" | "original_author" | "genres" | "tags" | "category" | "status" | "view_count" | "rating" | "updated_at"
>;

export function applyCatalogFilters<T extends CatalogNovel>(novels: T[], f: CatalogFilters): T[] {
  const q = f.query.trim().toLowerCase();
  const out = novels.filter((n) => {
    if (q) {
      const hay = [n.title, n.original_title, n.original_author].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.status && n.status !== f.status) return false;
    const labels = new Set([...(n.genres ?? []), ...(n.tags ?? []), n.category].filter(Boolean).map((s) => s.toLowerCase()));
    for (const [g, state] of Object.entries(f.genres)) {
      const has = labels.has(g.toLowerCase());
      if (state === "include" && !has) return false;
      if (state === "exclude" && has) return false;
    }
    return true;
  });
  const dir = f.ascending ? 1 : -1;
  out.sort((a, b) => {
    switch (f.sort) {
      case "popular": return dir * ((a.view_count ?? 0) - (b.view_count ?? 0));
      case "rating": return dir * ((a.rating ?? 0) - (b.rating ?? 0));
      case "title": return dir * a.title.localeCompare(b.title);
      default: return dir * (Date.parse(a.updated_at) - Date.parse(b.updated_at));
    }
  });
  return out;
}

export function countWords(text: string | null | undefined): { words: number; chars: number } {
  if (!text) return { words: 0, chars: 0 };
  const chars = text.replace(/\s/g, "").length;
  // CJK characters count as one word each
  const cjk = (text.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g) ?? []).length;
  const latin = text.replace(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/g, " ").split(/\s+/).filter(Boolean).length;
  return { words: cjk + latin, chars };
}

export const READER_FONTS = [
  { id: "lora", label: "Lora", css: "'Lora', serif" },
  { id: "merriweather", label: "Merriweather", css: "'Merriweather', serif" },
  { id: "garamond", label: "EB Garamond", css: "'EB Garamond', serif" },
  { id: "source-serif", label: "Source Serif", css: "'Source Serif 4', serif" },
  { id: "playfair", label: "Playfair Display", css: "'Playfair Display', serif" },
  { id: "inter", label: "Inter", css: "'Inter', sans-serif" },
  { id: "nunito", label: "Nunito Sans", css: "'Nunito Sans', sans-serif" },
  { id: "system", label: "System", css: "system-ui, sans-serif" },
] as const;

export interface ReaderSettings { font: string; size: number; lineHeight: number }
export const DEFAULT_READER: ReaderSettings = { font: "lora", size: 18, lineHeight: 1.85 };

export function parseReaderSettings(raw: string | null): ReaderSettings {
  try {
    const v = raw ? JSON.parse(raw) : {};
    const font = READER_FONTS.some((f) => f.id === v.font) ? v.font : DEFAULT_READER.font;
    const size = Math.min(32, Math.max(12, Number(v.size) || DEFAULT_READER.size));
    const lineHeight = Math.min(2.6, Math.max(1.2, Number(v.lineHeight) || DEFAULT_READER.lineHeight));
    return { font, size, lineHeight };
  } catch {
    return DEFAULT_READER;
  }
}

export interface ProgressEntry { slug: string; title: string; chapter: number; at: number }
export const PROGRESS_KEY = "readnovel-progress";

export function upsertProgress(list: ProgressEntry[], entry: ProgressEntry, max = 50): ProgressEntry[] {
  return [entry, ...list.filter((e) => e.slug !== entry.slug)].slice(0, max);
}
