import { describe, expect, it } from "vitest";
import { BUILTIN_PROFILES, extractChapterPage, matchProfile, validateProfile, type SelectorProfile } from "../lib/scraper-profiles";
import { stitchChapterPages } from "../lib/chapter-stitching";
import { prependJobLog } from "../lib/job-log";
import { formatTextLength } from "../lib/catalog";
const profile: SelectorProfile = { domain: "example.com", title: "h1", body: "#body", nextChapter: "#chapter", nextPage: "#page", remove: ".ad" };
const html = '<h1>Chapter one</h1><main id="body"><div><p>沈天很郁闷。</p><div class="ad">Donate now</div><p>He passed through.</p></div></main><a id="page" href="/1_2">Next page</a><a id="chapter" href="/2">Next chapter</a>';
describe("Domain selector extraction", () => {
  it("extracts nested chapter body without ads and distinguishes page/chapter links", () => {
    const result = extractChapterPage(html, "https://example.com/1", profile);
    expect(result.content).toBe("沈天很郁闷。\n\nHe passed through.");
    expect(result.nextPageUrl).toBe("https://example.com/1_2");
    expect(result.nextUrl).toBe("https://example.com/2");
  });
  it("uses the LNMTL chapter body, not toolbar details", () => {
    const result = extractChapterPage('<div>Comments 16 Report English Chinese</div><span class="chapter-title">One</span><div class="chapter-body"><sentence>沈天很郁闷。</sentence><sentence>Shen Tian is very depressed.</sentence></div>', "https://lnmtl.com/chapter/one", BUILTIN_PROFILES[0]);
    expect(result.content).toBe("沈天很郁闷。\n\nShen Tian is very depressed.");
  });
  it("uses LNMTL's next navigation link, not comment pagination", () => {
    const result = extractChapterPage('<span class="chapter-title">One</span><div class="chapter-body"><p>Story</p></div><ul><li class="next"><a href="/chapter/two">Next</a></li></ul>', "https://lnmtl.com/chapter/one", BUILTIN_PROFILES[0]);
    expect(result.nextUrl).toBe("https://lnmtl.com/chapter/two");
    expect(result.nextPageUrl).toBeNull();
  });
  it("matches actual domain boundaries", () => {
    expect(matchProfile("https://www.example.com/1", [profile])).toEqual(profile);
    expect(matchProfile("https://notexample.com/1", [profile])).toBeUndefined();
  });
  it("rejects missing body selectors rather than importing the whole page", () => {
    expect(() => extractChapterPage(html,"https://example.com/1",{...profile,body:"#missing"})).toThrow("did not match");
    expect(() => validateProfile({...profile, domain:"https://example.com"})).toThrow("domain only");
  });
});
describe("Chapter stitching", () => {
  it("merges continuation pages and leaves next chapter for the crawl", async () => {
    const calls: string[] = [];
    const result = await stitchChapterPages("https://example.com/1", async url => {
      calls.push(url); return {title:"One",content:url.endsWith("_2")?"Second part":"First part",nextPageUrl:url.endsWith("_2")?null:"https://example.com/1_2",nextUrl:"https://example.com/2"};
    },{enabled:true});
    expect(result.content).toBe("First part\n\nSecond part");
    expect(result.nextUrl).toBe("https://example.com/2");
    expect(calls).toEqual(["https://example.com/1","https://example.com/1_2"]);
  });
  it("does not merge next chapters", async () => {
    const result = await stitchChapterPages("https://example.com/1", async () => ({title:"One",content:"First",nextPageUrl:null,nextUrl:"https://example.com/2"}),{enabled:true});
    expect(result.pageCount).toBe(1);
  });
  it("rejects loops without saving partial text", async () => {
    await expect(stitchChapterPages("https://example.com/1", async () => ({title:"One",content:"First",nextPageUrl:"https://example.com/1",nextUrl:null}),{enabled:true})).rejects.toThrow("Repeated continuation");
  });
  it("rejects cross-site continuation", async () => {
    await expect(stitchChapterPages("https://example.com/1", async () => ({title:"One",content:"First",nextPageUrl:"https://other.com/1",nextUrl:null}),{enabled:true})).rejects.toThrow("another site");
  });
});
it("keeps newest chapter log first with language-aware lengths", () => {
  const entries = prependJobLog([{id:1,message:"Old",status:"info"}],{id:2,message:`Ch. 2 · ${formatTextLength("沈天很郁闷")} · ${formatTextLength("Shen Tian is depressed")}`,status:"success"});
  expect(entries[0]?.id).toBe(2);
  expect(entries[0]?.message).toBe("Ch. 2 · 5 characters · 4 words");
  expect(entries[1]?.id).toBe(1);
});
