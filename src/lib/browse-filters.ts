import type { NovelRecord } from './novels';
import { applyCatalogFilters } from './catalog';
export const BROWSE_SORTS = { recent: 'Latest updates', weekly: 'Top this week', popular: 'Most viewed', rating: 'Top rated', newest: 'Newest', chapters: 'Most chapters', title: 'Title A–Z' } as const;
export type BrowseSort = keyof typeof BROWSE_SORTS;
export type BrowseSearch = { q?: string; genre?: string; exclude?: string; tag?: string; excludeTag?: string; status?: string; sort?: BrowseSort; ascending?: boolean; page?: number; min?: number; language?: string; origin?: string; rating?: number; days?: number };
export function validateBrowseSearch(s: Record<string, unknown>): BrowseSearch {
  const out: BrowseSearch = {};
  for (const key of ['q', 'genre', 'exclude', 'tag', 'excludeTag', 'origin'] as const) if (typeof s[key] === 'string') out[key] = s[key];
  if (['ongoing', 'completed', 'hiatus'].includes(String(s['status']))) out.status = String(s['status']);
  if (['single', 'dual'].includes(String(s['language']))) out.language = String(s['language']);
  if (typeof s['sort'] === 'string' && Object.hasOwn(BROWSE_SORTS, s['sort'])) out.sort = s['sort'] as BrowseSort;
  if (s['ascending'] === true || s['ascending'] === 'true') out.ascending = true;
  for (const key of ['page', 'min', 'days'] as const) { const n = Number(s[key]); if (Number.isFinite(n) && n > 0) out[key] = Math.floor(n); }
  const rating = Number(s['rating']); if (Number.isFinite(rating) && rating > 0 && rating <= 5) out.rating = rating;
  return out;
}
export function selectedLabels(value?: string) { return (value || '').split(',').map(s => s.trim()).filter(Boolean); }
export function filterBrowseNovels<T extends NovelRecord>(novels: T[], search: BrowseSearch, now = Date.now()): T[] {
  const matches = (labels: string[], included?: string, excluded?: string) => {
    const values = new Set(labels.map(l => l.toLowerCase()));
    return selectedLabels(included).every(l => values.has(l.toLowerCase())) && selectedLabels(excluded).every(l => !values.has(l.toLowerCase()));
  };
  const results = applyCatalogFilters(novels, { query: search.q || '', genres: {}, status: search.status || '', sort: 'recent', ascending: false }).filter(n =>
    matches([...n.genres, n.category], search.genre, search.exclude) && matches(n.tags, search.tag, search.excludeTag) &&
    n.total_chapters >= (search.min || 0) && (!search.language || n.language_mode === search.language) &&
    (!search.origin || n.original_language?.toLowerCase() === search.origin.toLowerCase()) &&
    (!search.rating || (n.reviews_count > 0 && n.rating >= search.rating)) &&
    (!search.days || Date.parse(n.updated_at) >= now - search.days * 86400000)
  );
  const sort = search.sort || 'recent';
  const dir = search.ascending ? 1 : -1;
  return results.sort((a, b) => {
    if (sort === 'title') return (search.ascending ? -1 : 1) * a.title.localeCompare(b.title);
    const metric = (n: T) => sort === 'weekly' ? n.weekly_views : sort === 'popular' ? n.view_count : sort === 'rating' ? (n.reviews_count > 0 ? n.rating : 0) : sort === 'chapters' ? n.total_chapters : Date.parse(sort === 'newest' ? n.created_at : n.updated_at);
    return dir * (metric(a) - metric(b)) || a.title.localeCompare(b.title);
  });
}