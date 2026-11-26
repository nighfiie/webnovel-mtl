export const NOVEL_GENRES = [
  "Fantasy",
  "Xianxia",
  "Xuanhuan",
  "Action",
  "Adventure",
  "Romance",
  "Comedy",
  "Drama",
  "Martial Arts",
  "Supernatural",
  "Sci-fi",
  "Historical",
  "Mystery",
  "School Life",
  "Slice of Life",
  "Harem",
  "MTL",
  "Mature",
] as const;

export const NOVEL_STATUSES = ["ongoing", "completed", "hiatus"] as const;
export type NovelStatus = (typeof NOVEL_STATUSES)[number];
export type LanguageMode = "single" | "dual";

export interface NovelRecord {
  id: string;
  owner_id: string | null;
  slug: string;
  title: string;
  original_title: string | null;
  language_mode: string;
  translated_language: string | null;
  original_language: string | null;
  original_author: string | null;
  synopsis: string | null;
  cover_url: string | null;
  featured_image_url: string | null;
  category: string;
  genres: string[];
  tags: string[];
  status: string;
  total_chapters: number;
  rating: number;
  reviews_count: number;
  view_count: number;
  weekly_views: number;
  created_at: string;
  updated_at: string;
}

export interface ChapterRecord {
  id: string;
  novel_id: string;
  number: number;
  title: string;
  content_translated: string | null;
  content_original: string | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || `novel-${Date.now()}`;
}

export function cleanChapterText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/^首页\s*>.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}