import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { stripUnwantedLines } from "./crawl-utils";
import { extractChapterPage, matchProfile, validateProfile, BUILTIN_PROFILES, type SelectorProfile } from "./scraper-profiles";

export type ScraperEngine = "fallback" | "firecrawl";

export const fetchChapterContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { url: string; engine: ScraperEngine; firecrawlApiKey?: string; nextLinkText?: string; removePhrases?: string[]; profile?: SelectorProfile }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    const url = data.url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Please enter a valid http(s) URL");
    }

    const profile = data.profile ? validateProfile(data.profile) : matchProfile(url, BUILTIN_PROFILES);
    if (profile && !matchProfile(url, [profile])) throw new Error("Selector profile does not match this domain");

    if (data.engine === "firecrawl") {
      const apiKey =
        data.firecrawlApiKey?.trim() || process.env["FIRECRAWL_API_KEY"];
      if (!apiKey) {
        throw new Error(
          "Firecrawl API key is not configured. Enter your key in the importer or switch to Built-in Fallback.",
        );
      }

      const isGateway = apiKey.startsWith("lovc_");
      const endpoint = isGateway
        ? "https://connector-gateway.lovable.dev/firecrawl/v2/scrape"
        : "https://api.firecrawl.dev/v2/scrape";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (isGateway) {
        const lovableKey = process.env["LOVABLE_API_KEY"];
        if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");
        headers["Authorization"] = `Bearer ${lovableKey}`;
        headers["X-Connection-Api-Key"] = apiKey;
      } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          url,
          formats: ["markdown", "rawHtml"],
          onlyMainContent: true,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Firecrawl error (${res.status}): ${errText}`);
      }

      const json = (await res.json()) as {
        data?: { markdown?: string; rawHtml?: string; metadata?: { title?: string } };
      };
      const rawHtml = json.data?.rawHtml;
      if (!rawHtml) throw new Error("Firecrawl did not return HTML for selector extraction. Try the built-in engine.");
      const parsed = extractChapterPage(rawHtml, url, profile, data.nextLinkText);
      return { ...parsed, content: stripUnwantedLines(parsed.content, data.removePhrases ?? []), engine: "firecrawl" as const };
    }

    // Built-in fallback crawler (no third-party service)
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL (HTTP ${res.status})`);
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "";
    let html = new TextDecoder("utf-8").decode(buffer);
    const big5 = /charset=["']?big5/i.test(contentType) || /<meta[^>]*charset=["']?big5/i.test(html.slice(0, 2048));
    if (big5) {
      try { html = new TextDecoder("big5").decode(buffer); } catch { /* keep utf-8 */ }
    } else if (
      /charset=gb/i.test(contentType) ||
      /<meta[^>]*charset=["']?gb/i.test(html.slice(0, 2048)) ||
      (html.match(/\uFFFD/g)?.length ?? 0) > 5
    ) {
      try {
        html = new TextDecoder("gb18030").decode(buffer);
      } catch {
        // keep utf-8 if gb18030 is unavailable
      }
    }

    const parsed = extractChapterPage(html, url, profile, data.nextLinkText);
    if (!parsed.content) {
      throw new Error("Could not extract readable text from this page");
    }
    return {
      title: parsed.title,
      content: stripUnwantedLines(parsed.content, data.removePhrases ?? []),
      nextUrl: parsed.nextUrl,
      nextPageUrl: parsed.nextPageUrl,
      engine: "fallback" as const,
    };
  });

export const translateGoogleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { text: string; sourceLang?: string; targetLang?: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) {
      throw new Error("Admin access required");
    }

    const sl = data.sourceLang || "auto";
    const tl = data.targetLang || "en";
    const paragraphs = data.text
      .replace(/\r\n/g, "\n")
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    // Chunk paragraphs into <= 1800 char batches to stay within free endpoint limits
    const chunks: string[][] = [];
    let current: string[] = [];
    let currentLen = 0;
    for (const p of paragraphs) {
      if (currentLen + p.length + 2 > 1800 && current.length > 0) {
        chunks.push(current);
        current = [p];
        currentLen = p.length;
      } else {
        current.push(p);
        currentLen += p.length + 2;
      }
    }
    if (current.length > 0) chunks.push(current);

    const translatedParts: string[] = [];
    for (const chunk of chunks) {
      const q = chunk.join("\n");
      const params = new URLSearchParams({
        client: "gtx",
        sl,
        tl,
        dt: "t",
        q,
      });
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
      );
      if (!res.ok) {
        throw new Error(`Google Translate request failed (${res.status})`);
      }
      const json = (await res.json()) as unknown[];
      const segments = Array.isArray(json[0]) ? (json[0] as unknown[][]) : [];
      const translatedChunk = segments
        .map((seg) => (typeof seg[0] === "string" ? seg[0] : ""))
        .join("");
      translatedParts.push(translatedChunk.trim());
    }

    return {
      translatedText: translatedParts
        .join("\n\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    };
  });