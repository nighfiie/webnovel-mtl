import { describe, expect, it } from 'vitest';
import { detectChapterLanguage, paragraphLanguage, placeChapterContent, splitDualLanguage } from '../lib/chapter-language';
const en = 'The young master walked through the ancient forest. He knew that the people in the village were waiting for him to return home before the sun went down.';
const zh = '少年穿过古老的森林，他知道村里的人们都在等待他回来。夕阳落下的时候，他终于来到了山脚下，看到远处的村庄。';
describe('chapter language placement', () => {
  it('places English translations without replacing raw text', () => expect(placeChapterContent(en, 'auto', 'Chinese', 'English')).toEqual({ content_translated: en }));
  it('places Chinese in original text', () => expect(placeChapterContent(zh, 'auto', 'Chinese', 'English')).toEqual({ content_original: zh }));
  it('separates bilingual paragraphs', () => expect(placeChapterContent(`${zh}${zh}\n\n${en}`, 'auto', 'Chinese', 'English')).toEqual({ content_original: zh + zh, content_translated: en }));
  it('English originals stay original', () => expect(placeChapterContent(en, 'auto', 'English', 'French')).toEqual({ content_original: en }));
  it('does not assume every Latin text is English', () => expect(detectChapterLanguage('Le jeune homme marchait dans la forêt ancienne. Il savait que les habitants du village attendaient son retour avant le coucher du soleil.')).toBe('fra'));
  it('rejects uncertain short text for non-CJK novels', () => expect(() => placeChapterContent('Hello', 'auto', 'English', 'French')).toThrow('uncertain'));
  it('splits interleaved LNMTL lines into both columns', () => {
    const page = [zh, en, zh, en].join('\n');
    expect(placeChapterContent(page, 'auto', 'Chinese', 'English', 'dual')).toEqual({ content_original: `${zh}\n\n${zh}`, content_translated: `${en}\n\n${en}` });
  });
  it('keeps English with a stray Chinese name in the translation', () => expect(paragraphLanguage('Then Lin Feng (林枫) smiled and walked away from the crowd.')).toBe('other'));
  it('treats minor foreign footnotes as not mixed', () => expect(splitDualLanguage(`${en}\n${en}\n${en}\n仙子`).mixed).toBe(false));
  it('discards raw text for English-only novels', () => expect(placeChapterContent(`${zh}\n${en}`, 'auto', 'Chinese', 'English', 'single')).toEqual({ content_translated: en }));
  it('allows manual original override', () => expect(placeChapterContent(en, 'original')).toEqual({ content_original: en }));
  it('allows manual translated override', () => expect(placeChapterContent(zh, 'translated')).toEqual({ content_translated: zh }));
  it('mirrors only by explicit choice', () => expect(placeChapterContent(en, 'mirror')).toEqual({ content_original: en, content_translated: en }));
});