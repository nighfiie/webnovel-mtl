import { Star } from 'lucide-react';
import { readerRating } from '@/lib/ratings';
export function NovelRating({ novel, showCount = false }: { novel: { rating: number; reviews_count: number }; showCount?: boolean }) {
  const score = readerRating(novel);
  return <span className="inline-flex flex-wrap items-center gap-1 text-muted-foreground"><Star className="size-3.5 text-chart-4" />{score === null ? 'Unrated' : `${score.toFixed(1)} / 5`}{showCount && <span>· {novel.reviews_count} {novel.reviews_count === 1 ? 'review' : 'reviews'}</span>}</span>;
}