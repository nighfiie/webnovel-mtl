import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiProvider =
  | "lovable"
  | "openai"
  | "anthropic"
  | "gemini"
  | "deepseek"
  | "groq"
  | "openrouter"
  | "deepl";

const OPENAI_COMPATIBLE: Partial<Record<AiProvider, { baseUrl: string; model: string }>> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
};

interface TranslateInput {
  text: string;
  provider: AiProvider;
  systemPrompt: string;
  apiKey?: string;
  model?: string;
  targetLang?: string;
}

async function providerError(res: Response, name: string): Promise<never> {
  const body = await res.text().catch(() => "");
  console.error(`${name} translation failed [${res.status}]: ${body}`);
  throw new Error(`${name} error (${res.status}): ${body.slice(0, 300)}`);
}

export const translateAiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: TranslateInput) => {
    if (!input.text?.trim()) throw new Error("No text to translate");
    if (input.text.length > 200_000) throw new Error("Chapter is too long to translate in one go");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admin access required");

    const { text, provider, systemPrompt } = data;
    const apiKey = data.apiKey?.trim();

    if (provider === "lovable") {
      const { generateResponse, GatewayError } = await import("@lovable.dev/ai-gateway");
      try {
        const res = await generateResponse({
          model: "openai/gpt-6.1-sol",
          instructions: systemPrompt,
          input: text,
        });
        let out = "";
        for (const item of res.output ?? []) {
          if (item.type !== "message") continue;
          for (const part of item.content) {
            if (part.type === "output_text") out += part.text;
          }
        }
        if (!out.trim()) throw new Error("The AI returned an empty translation");
        return { translatedText: out.trim() };
      } catch (err) {
        if (err instanceof GatewayError) {
          console.error("AI gateway translation failed", err.code, err.httpStatus);
          if (err.httpStatus === 402) throw new Error("AI credits are used up. Add credits to keep translating.");
          if (err.httpStatus === 429) throw new Error("Too many AI requests right now. Wait a minute and try again.");
          throw new Error(`AI translation failed (${err.code})`);
        }
        throw err;
      }
    }

    if (!apiKey) throw new Error("Enter your API key for this provider in Translation Settings");

    if (provider === "deepl") {
      const host = apiKey.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
      const res = await fetch(`${host}/v2/translate`, {
        method: "POST",
        headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.split(/\n\s*\n/), target_lang: (data.targetLang || "EN-US").toUpperCase() }),
      });
      if (!res.ok) await providerError(res, "DeepL");
      const json = (await res.json()) as { translations?: Array<{ text: string }> };
      return { translatedText: (json.translations ?? []).map((t) => t.text).join("\n\n").trim() };
    }

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: data.model?.trim() || "claude-3-5-sonnet-latest",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: text }],
        }),
      });
      if (!res.ok) await providerError(res, "Claude");
      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const out = (json.content ?? []).map((c) => c.text ?? "").join("").trim();
      if (!out) throw new Error("Claude returned an empty translation");
      return { translatedText: out };
    }

    const cfg = OPENAI_COMPATIBLE[provider];
    if (!cfg) throw new Error("Unknown translation provider");
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: data.model?.trim() || cfg.model,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) await providerError(res, provider);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const out = json.choices?.[0]?.message?.content?.trim();
    if (!out) throw new Error("The provider returned an empty translation");
    return { translatedText: out };
  });
