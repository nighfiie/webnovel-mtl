import { describe, expect, it } from "vitest";
import { chapterRangeStart, chapterRanges, chaptersInRange, collectChapterPages } from "@/lib/chapter-navigation";

describe("chapter navigation", () => {
  it("groups chapters in blocks of 100 including chapters above 1000", () => {
    expect([1, 100, 101, 1000, 1001, 1100, 1101].map(chapterRangeStart)).toEqual([1, 1, 101, 901, 1001, 1001, 1101]);
  });

  it("keeps sparse and fractional chapter numbers without inventing empty ranges", () => {
    const chapters = [{ number: 1 }, { number: 100 }, { number: 100.5 }, { number: 1201 }];
    expect(chapterRanges(chapters)).toEqual([1, 1201]);
    expect(chaptersInRange(chapters, 1).map((c) => c.number)).toEqual([1, 100, 100.5]);
  });

  it("loads all 2501 rows across the API's 1000-row cap", async () => {
    const rows = Array.from({ length: 2501 }, (_, index) => ({ number: index + 1 }));
    const ranges: number[][] = [];
    const result = await collectChapterPages(async (from, to) => {
      ranges.push([from, to]);
      return rows.slice(from, to + 1);
    });
    expect(result).toHaveLength(2501);
    expect(result.at(-1)?.number).toBe(2501);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it("checks the next page for exact multiples instead of truncating", async () => {
    const rows = Array.from({ length: 2000 }, (_, index) => index);
    const starts: number[] = [];
    expect(await collectChapterPages(async (from, to) => {
      starts.push(from);
      return rows.slice(from, to + 1);
    })).toEqual(rows);
    expect(starts).toEqual([0, 1000, 2000]);
  });

  it("fails rather than returning an incomplete list when a later page fails", async () => {
    await expect(collectChapterPages(async (from) => {
      if (from > 0) throw new Error("Page failed");
      return Array.from({ length: 1000 }, (_, index) => index);
    })).rejects.toThrow("Page failed");
  });
});