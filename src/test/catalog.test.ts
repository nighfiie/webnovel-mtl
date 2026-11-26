import { describe, it, expect } from "vitest";
import { applyCatalogFilters, cycleTriState, countWords, textLength, parseReaderSettings, upsertProgress } from "@/lib/catalog";

const base = { original_title: null, original_author: null, tags: [], category: "", rating: 0 };
const novels = [
  { ...base, title: "Alpha", genres: ["Romance"], status: "ongoing", view_count: 5, updated_at: "2026-01-01" },
  { ...base, title: "Beta", genres: ["Xianxia", "Harem"], status: "completed", view_count: 50, updated_at: "2026-03-01" },
  { ...base, title: "Gamma", genres: ["Xianxia"], status: "ongoing", view_count: 20, updated_at: "2026-02-01", original_author: "Er Gen" },
];
const f = { query: "", genres: {}, status: "", sort: "recent" as const, ascending: false };

describe("catalog filters", () => {
  it("cycles include -> exclude -> neutral", () => {
    expect(cycleTriState(undefined)).toBe("include");
    expect(cycleTriState("include")).toBe("exclude");
    expect(cycleTriState("exclude")).toBeUndefined();
  });
  it("include and exclude genres", () => {
    const r = applyCatalogFilters(novels, { ...f, genres: { Xianxia: "include", Harem: "exclude" } });
    expect(r.map((n) => n.title)).toEqual(["Gamma"]);
  });
  it("searches original author", () => {
    expect(applyCatalogFilters(novels, { ...f, query: "er gen" }).map((n) => n.title)).toEqual(["Gamma"]);
  });
  it("filters status and sorts by popularity", () => {
    expect(applyCatalogFilters(novels, { ...f, status: "ongoing", sort: "popular" }).map((n) => n.title)).toEqual(["Gamma", "Alpha"]);
  });
});

describe("reader", () => {
  it("counts CJK chars as words", () => {
    expect(countWords("你好 world").words).toBe(3);
  });
  it("measures Chinese in characters", () => {
    expect(textLength("沈天很郁闷。他穿越了")).toEqual({ value: 9, unit: "characters" });
  });
  it("measures English in words", () => {
    expect(textLength("Shen Tian is very depressed .")).toEqual({ value: 5, unit: "words" });
  });
  it("clamps settings", () => {
    expect(parseReaderSettings('{"font":"nope","size":99}')).toEqual({ font: "lora", size: 32, lineHeight: 1.85 });
  });
  it("keeps latest progress per novel first", () => {
    const l = upsertProgress([{ slug: "a", title: "A", chapter: 1, at: 1 }], { slug: "a", title: "A", chapter: 5, at: 2 });
    expect(l).toEqual([{ slug: "a", title: "A", chapter: 5, at: 2 }]);
  });
});
