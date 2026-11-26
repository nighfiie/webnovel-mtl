// Pure helpers for site-migration CSV imports (novels + chapters).

export type CsvRow = Record<string, string>;

/** Parse RFC4180-style CSV; auto-detects comma vs semicolon delimiter from the header line. */
export function parseCsv(text: string): CsvRow[] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split("\n", 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i] ?? "";
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const header = rows[0]?.map((h) => h.trim().toLowerCase());
  if (!header) return [];
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: CsvRow = {};
      header.forEach((h, idx) => { obj[h] = r[idx] ?? ""; });
      return obj;
    });
}

/** Parse Postgres array literal `{a,"b c"}`, JSON array, or comma list. */
export function parseArrayField(value: string | undefined): string[] {
  const v = (value ?? "").trim();
  if (!v) return [];
  if (v.startsWith("[")) {
    try { const arr = JSON.parse(v); if (Array.isArray(arr)) return arr.map(String).map((s) => s.trim()).filter(Boolean); } catch { /* fallthrough */ }
  }
  const inner = v.startsWith("{") && v.endsWith("}") ? v.slice(1, -1) : v;
  const out: string[] = [];
  let cur = ""; let q = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i] ?? "";
    if (ch === '"') { q = !q; continue; }
    if (ch === "\\" && q) { cur += inner[i + 1] ?? ""; i++; continue; }
    if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter((s) => s && s.toUpperCase() !== "NULL");
}

const nul = (v: string | undefined) => { const t = (v ?? "").trim(); return t === "" || t.toUpperCase() === "NULL" ? null : t; };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable across retries; ASCII titles follow the site's existing slug convention. */
function generatedSlug(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (base) return base;
  const unicode = title.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (unicode) return unicode;
  let hash = 0;
  for (const char of title) hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0;
  return `novel-${hash.toString(36)}`;
}

export interface NovelImport {
  id?: string; slug: string; title: string;
  original_title: string | null; original_author: string | null; synopsis: string | null;
  cover_url: string | null; featured_image_url: string | null;
  category?: string; status?: string; language_mode?: string;
  original_language: string | null; translated_language: string | null;
  genres: string[]; tags: string[];
}

export function mapNovelRow(r: CsvRow): NovelImport | null {
  const title = nul(r["title"]);
  if (!title) return null;
  const slug = nul(r["slug"]) ?? generatedSlug(title);
  const n: NovelImport = {
    slug, title,
    original_title: nul(r["original_title"]), original_author: nul(r["original_author"]),
    synopsis: nul(r["synopsis"]), cover_url: nul(r["cover_url"]), featured_image_url: nul(r["featured_image_url"]),
    original_language: nul(r["original_language"]), translated_language: nul(r["translated_language"]),
    genres: parseArrayField(r["genres"]), tags: parseArrayField(r["tags"]),
  };
  const id = nul(r["id"]); if (id && UUID_RE.test(id)) n.id = id;
  const cat = nul(r["category"]); if (cat) n.category = cat;
  const st = nul(r["status"]); if (st) n.status = st;
  const lm = nul(r["language_mode"]); if (lm) n.language_mode = lm;
  return n;
}

export interface ExistingNovel { id: string; slug: string }

/** Split novels into new vs duplicate (matched by id or slug). Also dedupes inside the file by slug. */
export function classifyNovels(rows: NovelImport[], existing: ExistingNovel[]) {
  const bySlug = new Map(existing.map((e) => [e.slug, e.id]));
  const ids = new Set(existing.map((e) => e.id));
  const seen = new Set<string>();
  const fresh: NovelImport[] = []; const duplicates: Array<NovelImport & { existingId: string }> = [];
  let inFileDuplicates = 0;
  for (const n of rows) {
    if (seen.has(n.slug)) { inFileDuplicates++; continue; }
    seen.add(n.slug);
    const match = (n.id && ids.has(n.id) ? n.id : undefined) ?? bySlug.get(n.slug);
    if (match) duplicates.push({ ...n, existingId: match }); else fresh.push(n);
  }
  return { fresh, duplicates, inFileDuplicates };
}

export interface ChapterImport {
  novel_id: string; number: number; title: string;
  content_original: string | null; content_translated: string | null; source_url: string | null;
}

export interface ChapterLookup {
  /** old/new novel id -> current novel id */ byId: Map<string, string>;
  /** slug -> current novel id */ bySlug: Map<string, string>;
}

/** Assign chapter rows to novels by novel_id (or novel_slug / slug). Returns unmatched rows separately. */
export function resolveChapters(rows: CsvRow[], lookup: ChapterLookup, clean: (s: string) => string = (s) => s) {
  const matched: ChapterImport[] = []; const unmatched: CsvRow[] = []; const invalid: CsvRow[] = [];
  const seen = new Set<string>(); let inFileDuplicates = 0;
  for (const r of rows) {
    const rawId = nul(r["novel_id"]); const rawSlug = nul(r["novel_slug"]) ?? nul(r["slug"]);
    const novelId = (rawId ? lookup.byId.get(rawId) : undefined) ?? (rawSlug ? lookup.bySlug.get(rawSlug) : undefined);
    const num = Number(nul(r["number"]) ?? NaN);
    if (!Number.isFinite(num)) { invalid.push(r); continue; }
    if (!novelId) { unmatched.push(r); continue; }
    const key = `${novelId}:${num}`;
    if (seen.has(key)) { inFileDuplicates++; continue; }
    seen.add(key);
    const orig = nul(r["content_original"]);
    matched.push({
      novel_id: novelId, number: num,
      title: nul(r["title"]) ?? `Chapter ${num}`,
      content_original: orig ? clean(orig) : null,
      content_translated: nul(r["content_translated"]),
      source_url: nul(r["source_url"]),
    });
  }
  return { matched, unmatched, invalid, inFileDuplicates };
}

export function chapterKey(novelId: string, num: number) { return `${novelId}:${Number(num)}`; }
