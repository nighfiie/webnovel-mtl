// Pure helpers for the auto-crawler (safe for browser and server).

const NEXT_PATTERNS = [
  /^\s*next(\s+chapter)?\s*(»|>|→|›)?\s*$/i,
  /下一章|下一页|下一節|下一节|下章/,
  /다음\s*화|다음\s*장|다음/,
  /次の話|次へ|次話/,
  /^\s*(»|>|→|›)\s*$/,
];

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&raquo;/gi, "»")
    .replace(/&rsaquo;/gi, "›")
    .replace(/&rarr;/gi, "→");
}

/** Find the "Next Chapter" link in a page's HTML. Returns an absolute URL or null. */
export function findNextChapterUrl(html: string, pageUrl: string, customLinkText?: string): string | null {
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  const custom = customLinkText?.trim().toLowerCase();
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html))) {
    const attrs = m[1] ?? "";
    const text = decodeEntities((m[2] ?? "").replace(/<[^>]+>/g, "")).trim();
    const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || href.startsWith("javascript:") || href === "#") continue;
    const relNext = /rel\s*=\s*["'][^"']*next/i.test(attrs);
    const idNext = /(id|class)\s*=\s*["'][^"']*(next_?chap|next-chap|nextchap|chapter-next|btn-next)/i.test(attrs);
    const matches = custom
      ? text.toLowerCase().includes(custom)
      : relNext || idNext || NEXT_PATTERNS.some((p) => p.test(text));
    if (!matches) continue;
    try {
      const abs = new URL(decodeEntities(href), pageUrl).toString();
      if (abs === pageUrl) continue;
      return abs;
    } catch {
      continue;
    }
  }
  return null;
}

/** Remove any line containing one of the given phrases (ads, watermarks, notes). */
export function stripUnwantedLines(content: string, phrases: string[]): string {
  const list = phrases.map((p) => p.trim()).filter(Boolean);
  if (list.length === 0) return content;
  return content
    .split("\n")
    .filter((line) => !list.some((p) => line.includes(p)))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Milliseconds to wait before fetching the chapter at index `i` (0-based). */
export function crawlDelayBefore(i: number, delayMs: number, pauseEvery: number, pauseMs: number): number {
  if (i <= 0) return 0;
  if (pauseEvery > 0 && i % pauseEvery === 0) return Math.max(delayMs, pauseMs);
  return delayMs;
}
