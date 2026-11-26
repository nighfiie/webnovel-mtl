import { francAll } from 'franc-min';

export type ContentPlacement = 'auto' | 'original' | 'translated' | 'mirror';
const LANGUAGE_CODES: Record<string, string> = {
  english: 'eng', en: 'eng', chinese: 'cmn', zh: 'cmn', japanese: 'jpn', ja: 'jpn',
  korean: 'kor', ko: 'kor', french: 'fra', fr: 'fra', spanish: 'spa', es: 'spa',
  german: 'deu', de: 'deu', russian: 'rus', ru: 'rus', portuguese: 'por', pt: 'por',
  vietnamese: 'vie', vi: 'vie', indonesian: 'ind', id: 'ind', thai: 'tha', th: 'tha',
};
function code(language: string | null | undefined, fallback: string) {
  const key = language?.toLowerCase().trim() || fallback;
  return LANGUAGE_CODES[key] || key;
}

export function detectChapterLanguage(text: string): string | null {
  const letters = text.match(/\p{L}/gu)?.length || 0;
  if (letters < 12) return null;
  const count = (pattern: RegExp) => (text.match(pattern)?.length || 0) / letters;
  if (count(/[\uac00-\ud7af]/g) > .2) return 'kor';
  if (count(/[\u3040-\u30ff]/g) > .05) return 'jpn';
  if (count(/[\u3400-\u9fff]/g) > .4) return 'cmn';
  const candidates = francAll(text, { minLength: 30 });
  const first = candidates[0];
  const second = candidates[1];
  if (!first || first[0] === 'und' || (second && first[1] - second[1] < .03)) return null;
  return first[0];
}

/** CJK/Latin script splitting for bilingual (MTL) pages such as LNMTL. */
export type ScriptClass = 'zh' | 'en' | 'other';
const CJK = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;

export function paragraphLanguage(line: string): ScriptClass {
  const letters = line.replace(/[^\p{L}]/gu, '');
  if (!letters) return 'other';
  const cjk = (letters.match(CJK) ?? []).length;
  const ratio = cjk / letters.length;
  if (ratio > 0.3) return 'zh';
  if (ratio === 0) return 'en';
  return 'other';
}

export function splitDualLanguage(text: string) {
  const zh: string[] = [], en: string[] = [];
  for (const p of text.split(/\n+/).map(s => s.trim()).filter(Boolean)) {
    let c = paragraphLanguage(p);
    if (c === 'other') {
      if (!p.replace(/[^\p{L}]/gu, '')) continue; // punctuation/number-only furniture
      c = (p.match(CJK) ?? []).length > 0 ? 'zh' : 'en';
    }
    (c === 'zh' ? zh : en).push(p);
  }
  const chinese = zh.join('\n\n'), english = en.join('\n\n');
  const total = chinese.length + english.length || 1;
  const mixed = chinese.length > 80 && english.length > 80 && Math.min(chinese.length, english.length) / total > 0.15;
  return { chinese, english, mixed };
}

const CJK_LANGS = new Set(['cmn', 'zho', 'chi', 'chinese', 'zh']);

/** Only return populated columns: importing a translation must not erase existing raw text. */
export function placeChapterContent(text: string, placement: ContentPlacement, originalLanguage?: string | null, translatedLanguage?: string | null, languageMode?: string | null) {
  const content = text.trim();
  if (!content) throw new Error('No chapter text found.');
  if (placement === 'original') return { content_original: content };
  if (placement === 'translated') return { content_translated: content };
  if (placement === 'mirror') return { content_original: content, content_translated: content };
  const originalCode = code(originalLanguage, 'chinese');
  const targetCode = code(translatedLanguage, 'english');
  if (CJK_LANGS.has(originalCode)) {
    const page = splitDualLanguage(content);
    const dual = !languageMode || languageMode === 'dual';
    if (!dual && languageMode !== 'original') {
      if (page.english) return { content_translated: page.english };
      if (page.chinese) return { content_original: page.chinese };
    }
    if (page.mixed) return dual ? { content_original: page.chinese, content_translated: page.english } : { content_original: page.chinese };
    if (page.chinese.length > page.english.length) return { content_original: dual ? content : page.chinese };
    if (page.english) return { content_translated: page.english };
    throw new Error('No readable chapter text found.');
  }
  const overall = detectChapterLanguage(content);
  const original: string[] = [], translated: string[] = [];
  for (const paragraph of content.split(/\n+/).map(p => p.trim()).filter(Boolean)) {
    const language = detectChapterLanguage(paragraph) || overall;
    if (language === originalCode) original.push(paragraph);
    else if (language === targetCode) translated.push(paragraph);
    else throw new Error('Language is uncertain or does not match this novel. Choose Original or Translated placement and retry.');
  }
  return {
    ...(original.length ? { content_original: original.join('\n\n') } : {}),
    ...(translated.length ? { content_translated: translated.join('\n\n') } : {}),
  };
}