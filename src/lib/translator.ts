import { translateGoogleFn } from "./scraper.functions";
import { translateAiFn, type AiProvider } from "./ai-translate.functions";
import { buildTranslationPrompt, type GenrePreset } from "./translation-prompts";

export type TranslationEngine = "google" | "lmstudio" | AiProvider;

export const ENGINE_LABELS: Record<TranslationEngine, string> = {
  google: "Google Translate (free)",
  lovable: "Built-in AI (no key needed)",
  deepl: "DeepL (your key)",
  openai: "OpenAI (your key)",
  anthropic: "Anthropic Claude (your key)",
  gemini: "Google Gemini (your key)",
  deepseek: "DeepSeek (your key)",
  groq: "Groq (your key)",
  openrouter: "OpenRouter (your key)",
  lmstudio: "Local LLM / Ollama / LM Studio",
};

export interface AiTranslationSettings {
  genre: GenrePreset;
  glossary: string;
  customInstructions: string;
  targetLanguage: string;
  keys: Partial<Record<AiProvider, string>>;
  models: Partial<Record<AiProvider, string>>;
}

const AI_STORAGE_KEY = "readnovel_ai_translation_settings";

export const DEFAULT_AI_SETTINGS: AiTranslationSettings = {
  genre: "general",
  glossary: "",
  customInstructions: "",
  targetLanguage: "English",
  keys: {},
  models: {},
};

export function loadAiSettings(): AiTranslationSettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY);
    return raw ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) } : DEFAULT_AI_SETTINGS;
  } catch {
    return DEFAULT_AI_SETTINGS;
  }
}

export function saveAiSettings(settings: AiTranslationSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(settings));
}

export interface LocalLlmConfig {
  baseUrl: string;
  model: string;
  systemPrompt: string;
}

const STORAGE_KEY = "readnovel_local_llm_config";

export const DEFAULT_LOCAL_LLM_CONFIG: LocalLlmConfig = {
  baseUrl: "http://localhost:1234/v1",
  model: "local-model",
  systemPrompt:
    "You are an expert web novel translator. Translate the following chapter into natural, fluent English. Preserve paragraph breaks (one translated paragraph per original paragraph). Output only the translated text without commentary.",
};

export function loadLocalLlmConfig(): LocalLlmConfig {
  if (typeof window === "undefined") return DEFAULT_LOCAL_LLM_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_LLM_CONFIG;
    return { ...DEFAULT_LOCAL_LLM_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LOCAL_LLM_CONFIG;
  }
}

export function saveLocalLlmConfig(config: LocalLlmConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function translateWithLocalLLM(
  text: string,
  config: LocalLlmConfig,
  signal?: AbortSignal,
): Promise<string> {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(signal ? { signal } : {}),
    body: JSON.stringify({
      model: config.model || "local-model",
      temperature: 0.3,
      messages: [
        { role: "system", content: config.systemPrompt },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(
      `LM Studio error (${res.status}): ${errBody || "Make sure LM Studio server is running with CORS enabled."}`,
    );
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("LM Studio returned an empty translation");
  }
  return content;
}

async function translateWithGoogleBrowser(
  text: string,
  sourceLang: string,
  targetLang: string,
  signal?: AbortSignal,
): Promise<string> {
  const paragraphs = text.split(/\r?\n/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const next = current ? `${current}\n${para}` : para;
    if (next.length > 1600 && current) {
      chunks.push(current);
      current = para;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  const translatedChunks: string[] = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) {
      translatedChunks.push(chunk);
      continue;
    }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang,
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(chunk)}`;

    const res = await fetch(url, { ...(signal ? { signal } : {}) });
    if (!res.ok) {
      throw new Error(`Google Translate HTTP ${res.status}`);
    }
    const json = (await res.json()) as [Array<[string, string]>];
    const segments = Array.isArray(json?.[0]) ? json[0] : [];
    translatedChunks.push(segments.map((seg) => seg?.[0] ?? "").join(""));
  }

  return translatedChunks.join("\n");
}

export async function translateChapterText(options: {
  text: string;
  engine: TranslationEngine;
  sourceLang?: string;
  targetLang?: string;
  localLlmConfig?: LocalLlmConfig;
  aiSettings?: AiTranslationSettings;
  signal?: AbortSignal;
}): Promise<string> {
  if (!options.text.trim()) {
    throw new Error("No original text to translate");
  }

  if (options.engine !== "google" && options.engine !== "lmstudio") {
    const ai = options.aiSettings ?? loadAiSettings();
    const provider = options.engine;
    const systemPrompt = buildTranslationPrompt({
      targetLanguage: ai.targetLanguage || "English",
      genre: ai.genre,
      glossary: ai.glossary,
      customInstructions: ai.customInstructions,
    });
    const key = ai.keys[provider];
    const model = ai.models[provider];
    const res = await translateAiFn({
      data: {
        text: options.text,
        provider,
        systemPrompt,
        ...(key ? { apiKey: key } : {}),
        ...(model ? { model } : {}),
        ...(options.targetLang ? { targetLang: options.targetLang } : {}),
      },
    });
    return res.translatedText;
  }

  if (options.engine === "lmstudio") {
    return translateWithLocalLLM(
      options.text,
      options.localLlmConfig ?? loadLocalLlmConfig(),
      options.signal,
    );
  }

  const sourceLang = options.sourceLang ?? "auto";
  const targetLang = options.targetLang ?? "en";

  if (typeof window !== "undefined") {
    try {
      return await translateWithGoogleBrowser(
        options.text,
        sourceLang,
        targetLang,
        options.signal,
      );
    } catch {
      // Fallback to server-side Google Translate if browser fetch fails
    }
  }

  const res = await translateGoogleFn({
    data: {
      text: options.text,
      sourceLang,
      targetLang,
    },
  });
  return res.translatedText;
}