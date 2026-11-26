// Prompt building for AI translation (pure, browser-safe).

export type GenrePreset = "general" | "wuxia" | "xianxia" | "light_novel" | "korean";

export const GENRE_PRESETS: Record<GenrePreset, { label: string; guidance: string }> = {
  general: { label: "General web novel", guidance: "Keep the tone natural and easy to read." },
  wuxia: {
    label: "Wuxia (martial arts)",
    guidance: "Use established wuxia terms (sect, martial uncle, qi, inner energy, Jianghu). Keep fight scenes punchy.",
  },
  xianxia: {
    label: "Xianxia / Cultivation",
    guidance: "Keep cultivation realm names consistent (Qi Condensation, Foundation Establishment, Golden Core, Nascent Soul). Preserve terms like dao, spirit stones, immortal.",
  },
  light_novel: {
    label: "Japanese Light Novel",
    guidance: "Keep Japanese honorifics (-san, -kun, -chan, -sama, senpai). Keep a light, conversational voice.",
  },
  korean: {
    label: "Korean web novel",
    guidance: "Keep Korean honorifics and titles (hyung, noona, sunbae, -nim) untranslated. Keep game-system windows in [brackets].",
  },
};

/** Parse glossary text: one "original = translation" per line. */
export function parseGlossary(text: string): Array<{ source: string; target: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\s*(?:=|=>|→)\s*/))
    .filter((parts) => parts.length >= 2 && parts[0]!.trim() && parts[1]!.trim())
    .map((parts) => ({ source: parts[0]!.trim(), target: parts.slice(1).join("=").trim() }));
}

export function buildTranslationPrompt(opts: {
  targetLanguage: string;
  genre: GenrePreset;
  glossary: string;
  customInstructions?: string;
}): string {
  const lines = [
    `You are an expert web novel translator. Translate the chapter into natural, fluent ${opts.targetLanguage}.`,
    "Keep one translated paragraph per original paragraph, separated by blank lines.",
    "Output only the translated text. No notes, no commentary, no headings you invent.",
    GENRE_PRESETS[opts.genre].guidance,
  ];
  const glossary = parseGlossary(opts.glossary);
  if (glossary.length > 0) {
    lines.push("Always use these exact translations for names and terms:");
    for (const g of glossary) lines.push(`- ${g.source} → ${g.target}`);
  }
  if (opts.customInstructions?.trim()) lines.push(opts.customInstructions.trim());
  return lines.join("\n");
}
