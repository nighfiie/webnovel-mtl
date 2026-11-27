export interface ScrapedPage { title: string; content: string; nextUrl: string | null; nextPageUrl: string | null }
/** Fetch one page per request. Continuations must be explicit, same-origin, and acyclic. */
export async function stitchChapterPages<T extends ScrapedPage>(url: string, fetchPage: (url: string) => Promise<T>, options: { enabled: boolean; stopped?: () => boolean; onPage?: (url: string, page: T, number: number) => void; delayMs?: number }) {
  let current = url;
  const seen = new Set<string>();
  const contents: string[] = [];
  let first: T | undefined;
  let last: T | undefined;
  while (true) {
    if (options.stopped?.()) throw new Error("Stopped before saving the complete chapter");
    if (seen.has(current)) throw new Error("Repeated continuation URL; chapter was not saved");
    if (new URL(current).origin !== new URL(url).origin) throw new Error("Continuation points to another site; chapter was not saved");
    seen.add(current);
    const page = await fetchPage(current);
    if (options.stopped?.()) throw new Error("Stopped before saving the complete chapter");
    first ??= page;
    last = page;
    if (!contents.includes(page.content)) contents.push(page.content);
    options.onPage?.(current, page, seen.size);
    if (!options.enabled || !page.nextPageUrl) break;
    if (seen.size >= 20) throw new Error("Chapter exceeds 20 continuation pages; chapter was not saved");
    current = page.nextPageUrl;
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
  }
  if (!first || !last) throw new Error("No chapter pages fetched");
  return { ...first, content: contents.join("\n\n"), nextUrl: last.nextUrl || first.nextUrl, nextPageUrl: null, pageCount: seen.size };
}
