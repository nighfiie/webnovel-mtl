export function readerRating(novel: { rating: number; reviews_count: number }): number | null {
  return novel.reviews_count > 0 ? novel.rating : null;
}