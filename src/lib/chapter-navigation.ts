export const CHAPTER_RANGE_SIZE = 100;

export type ChapterSummary = { id: string; number: number; title: string };

export function chapterRangeStart(number: number): number {
  return Math.max(1, Math.floor((number - 1) / CHAPTER_RANGE_SIZE) * CHAPTER_RANGE_SIZE + 1);
}

export function chapterRanges(chapters: readonly { number: number }[]): number[] {
  return [...new Set(chapters.map((chapter) => chapterRangeStart(chapter.number)))].sort((a, b) => a - b);
}

export function chaptersInRange<T extends { number: number }>(chapters: readonly T[], start: number): T[] {
  return chapters.filter((chapter) => chapterRangeStart(chapter.number) === start);
}

// A page smaller than the requested size ends the scan; never raise the API row cap.
export async function collectChapterPages<T>(
  fetchPage: (from: number, to: number) => Promise<readonly T[]>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await fetchPage(from, from + pageSize - 1);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}