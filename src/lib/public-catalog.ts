import { queryOptions } from '@tanstack/react-query';
import { readPublicCatalog } from './public-catalog.functions';
import type { NovelRecord } from './novels';

export const publicCatalogOptions = queryOptions({
  queryKey: ['catalog', 'public'],
  queryFn: () => readPublicCatalog(),
  staleTime: 0,
  refetchInterval: 30000,
});
export type RankingMetric = 'weekly' | 'popular' | 'rating';
export function rankNovels<T extends Pick<NovelRecord, 'weekly_views' | 'view_count' | 'rating' | 'title'>>(novels: T[], metric: RankingMetric): T[] {
  const key = metric === 'weekly' ? 'weekly_views' : metric === 'popular' ? 'view_count' : 'rating';
  return [...novels].sort((a, b) => b[key] - a[key] || a.title.localeCompare(b.title));
}
export function catalogLabels(novels: Pick<NovelRecord, 'genres' | 'category'>[]) {
  const counts = new Map<string, number>();
  for (const n of novels) for (const label of new Set([...n.genres, n.category].filter(Boolean))) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
export function catalogHead(title: string, description: string) {
  return { meta: [{ title: `${title} | ReadNovel` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} | ReadNovel` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] };
}
