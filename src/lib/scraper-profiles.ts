import { parseHTML } from "linkedom";
import { findNextChapterUrl } from "./crawl-utils";

export interface SelectorProfile {
  domain: string;
  title: string;
  body: string;
  nextChapter: string;
  nextPage: string;
  remove: string;
}
export const PROFILE_STORAGE_KEY = "readnovel-selector-profiles";
export const BUILTIN_PROFILES: SelectorProfile[] = [{ domain: "lnmtl.com", title: ".chapter-title", body: ".chapter-body", nextChapter: ".next a", nextPage: "", remove: "script, style, nav, .advertisement" }];
export function matchProfile(url: string, profiles: SelectorProfile[]): SelectorProfile | undefined {
  const host = new URL(url).hostname.toLowerCase();
  return profiles.filter(p => host === p.domain || host.endsWith(`.${p.domain}`)).sort((a,b) => b.domain.length - a.domain.length)[0];
}
export function validateProfile(profile: SelectorProfile): SelectorProfile {
  const domain = profile.domain.trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) throw new Error("Enter a domain only, such as lnmtl.com");
  if (!profile.body.trim()) throw new Error("A chapter body selector is required");
  const { document } = parseHTML("<html><body></body></html>");
  for (const selector of [profile.title, profile.body, profile.nextChapter, profile.nextPage, profile.remove]) {
    if (selector.trim()) document.querySelector(selector);
  }
  return { ...profile, domain };
}
export function extractChapterPage(html: string, url: string, profile?: SelectorProfile, nextLinkText?: string) {
  const { document } = parseHTML(html);
  const link = (selector: string): string | null => {
    const href = document.querySelector(selector)?.getAttribute("href");
    if (!href) return null;
    const resolved = new URL(href, url);
    return /^https?:$/.test(resolved.protocol) && resolved.href !== url ? resolved.href : null;
  };
  // Resolve navigation before removing any toolbar elements.
  const nextPageUrl = profile?.nextPage ? link(profile.nextPage) : null;
  const nextUrl = profile?.nextChapter ? link(profile.nextChapter) : findNextChapterUrl(html, url, nextLinkText);
  const title = document.querySelector(profile?.title || ".chapter-title, h1, title")?.textContent?.trim() || "Imported Chapter";
  if (profile?.remove) document.querySelectorAll(profile.remove).forEach(node => node.remove());
  document.querySelectorAll("script, style, nav, header, footer").forEach(node => node.remove());
  const body = profile ? document.querySelector(profile.body) : document.querySelector(".chapter-body, .txtnav, #content, #chaptercontent, #BookText, #txt, article, main") || document.body;
  if (!body) throw new Error(`Chapter body selector did not match: ${profile?.body}`);
  body.querySelectorAll("br").forEach(node => node.replaceWith(document.createTextNode("\n")));
  body.querySelectorAll("p, div, sentence, li").forEach(node => node.appendChild(document.createTextNode("\n\n")));
  const content = (body.textContent || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!content) throw new Error("The chapter body is empty");
  return { title, content, nextUrl: nextUrl === nextPageUrl ? null : nextUrl, nextPageUrl };
}
