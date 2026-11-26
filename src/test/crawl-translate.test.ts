import { describe, expect, it } from "vitest";
import { crawlDelayBefore, findNextChapterUrl, stripUnwantedLines } from "@/lib/crawl-utils";
import { buildTranslationPrompt, parseGlossary } from "@/lib/translation-prompts";

describe("auto-crawler pacing", () => {
  it("waits 2.5s between chapters", () => {
    expect(crawlDelayBefore(1, 2500, 10, 10000)).toBe(2500);
  });
  it("pauses 10s every 10 chapters", () => {
    expect(crawlDelayBefore(10, 2500, 10, 10000)).toBe(10000);
    expect(crawlDelayBefore(20, 2500, 10, 10000)).toBe(10000);
  });
  it("does not wait before the first chapter", () => {
    expect(crawlDelayBefore(0, 2500, 10, 10000)).toBe(0);
  });
});

describe("next chapter detection", () => {
  it("finds Chinese next link", () => {
    const html = '<a href="/b/1.html">上一章</a><a href="/b/3.html">下一章</a>';
    expect(findNextChapterUrl(html, "https://x.com/b/2.html")).toBe("https://x.com/b/3.html");
  });
  it("uses custom link text", () => {
    const html = '<a href="/c/9">Continue reading</a>';
    expect(findNextChapterUrl(html, "https://x.com/c/8", "continue")).toBe("https://x.com/c/9");
  });
  it("returns null when absent", () => {
    expect(findNextChapterUrl('<a href="/">Home</a>', "https://x.com/c/8")).toBeNull();
  });
});

describe("content cleanup and glossary", () => {
  it("removes ad lines", () => {
    expect(stripUnwantedLines("Hello\nVisit site.com for more\nBye", ["site.com"])).toBe("Hello\nBye");
  });
  it("puts glossary terms in the prompt", () => {
    expect(parseGlossary("林动 = Lin Dong")).toEqual([{ source: "林动", target: "Lin Dong" }]);
    expect(buildTranslationPrompt({ targetLanguage: "English", genre: "xianxia", glossary: "林动 = Lin Dong" })).toContain("林动 → Lin Dong");
  });
});
