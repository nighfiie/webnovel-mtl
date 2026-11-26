import { describe, expect, it } from "vitest";
import { classifyNovels, mapNovelRow, parseArrayField, parseCsv, resolveChapters } from "@/lib/migration-csv";

describe("migration csv", () => {
  it("parses comma CSV with quoted newlines", () => {
    const rows = parseCsv('id,title,body\n1,"A, b","line1\nline2"\n');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.["title"]).toBe("A, b");
    expect(rows[0]?.["body"]).toBe("line1\nline2");
  });
  it("detects semicolon delimiter", () => {
    expect(parseCsv("a;b\n1;2")[0]?.["b"]).toBe("2");
  });
  it("parses postgres arrays", () => {
    expect(parseArrayField('{Action,"Slice of Life"}')).toEqual(["Action", "Slice of Life"]);
    expect(parseArrayField('["x","y"]')).toEqual(["x", "y"]);
  });
  it("flags novel duplicates by slug or id", () => {
    const a = mapNovelRow({ title: "A", slug: "a" });
    const b = mapNovelRow({ title: "B", slug: "b", id: "11111111-1111-1111-1111-111111111111" });
    const c = mapNovelRow({ title: "C", slug: "c" });
    if (!a || !b || !c) throw new Error("Valid novels must map");
    const r = classifyNovels([a, b, c, a], [{ id: "x", slug: "a" }, { id: "11111111-1111-1111-1111-111111111111", slug: "other" }]);
    expect(r.fresh.map((n) => n.slug)).toEqual(["c"]);
    expect(r.duplicates.map((n) => n.existingId)).toEqual(["x", "11111111-1111-1111-1111-111111111111"]);
    expect(r.inFileDuplicates).toBe(1);
  });
  it("assigns chapters to novels by old id or slug and drops in-file duplicates", () => {
    const lookup = { byId: new Map([["old-1", "new-1"]]), bySlug: new Map([["s2", "new-2"]]) };
    const r = resolveChapters([
      { novel_id: "old-1", number: "1", title: "One" },
      { novel_id: "old-1", number: "1", title: "Dup" },
      { novel_slug: "s2", number: "2" },
      { novel_id: "missing", number: "3" },
    ], lookup);
    expect(r.matched.map((c) => `${c.novel_id}:${c.number}`)).toEqual(["new-1:1", "new-2:2"]);
    expect(r.inFileDuplicates).toBe(1);
    expect(r.unmatched).toHaveLength(1);
  });
  it("accepts the old site's novel export without a slug column", () => {
    const rows = parseCsv('id,owner_id,title,original_title,language_mode,translated_language,original_language,original_author,synopsis,cover_url,category,status,created_at,updated_at,view_count,featured_image_url\n84de30ed-a305-4c16-b53a-32e160669546,old-owner,The fairies are all too clingy,仙子,dual,English,Chinese,Author,"Line one\nLine two",,Xianxia,ongoing,2026-01-01,2026-01-02,12,');
    const row = rows[0];
    if (!row) throw new Error("Missing CSV row");
    const novel = mapNovelRow(row);
    expect(novel?.slug).toBe("the-fairies-are-all-too-clingy");
    expect(novel?.id).toBe("84de30ed-a305-4c16-b53a-32e160669546");
    expect(novel?.synopsis).toBe("Line one\nLine two");
  });
  it("keeps explicit slugs and generates stable slugs for blank or non-Latin titles", () => {
    expect(mapNovelRow({ title: "Changed Title", slug: "original-slug" })?.slug).toBe("original-slug");
    expect(mapNovelRow({ title: "The fairies are all too clingy", slug: "" })?.slug).toBe("the-fairies-are-all-too-clingy");
    expect(mapNovelRow({ title: "重生后才发现我有青梅" })?.slug).toBe("重生后才发现我有青梅");
    expect(mapNovelRow({ title: "" })).toBeNull();
  });
  it("detects retries without slugs as duplicates and links their old chapter novel id", () => {
    const novel = mapNovelRow({ id: "84de30ed-a305-4c16-b53a-32e160669546", title: "The fairies are all too clingy" });
    if (!novel) throw new Error("Novel must map");
    const classified = classifyNovels([novel, novel], [{ id: "current-id", slug: "the-fairies-are-all-too-clingy" }]);
    expect(classified.fresh).toHaveLength(0);
    expect(classified.duplicates[0]?.existingId).toBe("current-id");
    expect(classified.inFileDuplicates).toBe(1);
    const chapters = resolveChapters([{ novel_id: "84de30ed-a305-4c16-b53a-32e160669546", number: "1", content_original: "原文", content_translated: "Translation" }], { byId: new Map([["84de30ed-a305-4c16-b53a-32e160669546", "current-id"]]), bySlug: new Map() });
    expect(chapters.matched[0]).toMatchObject({ novel_id: "current-id", number: 1, content_original: "原文", content_translated: "Translation" });
    expect(chapters.unmatched).toHaveLength(0);
  });
});
