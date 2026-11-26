import { describe, expect, it } from 'vitest';
import { filterBrowseNovels, validateBrowseSearch } from '../lib/browse-filters';
import type { NovelRecord } from '../lib/novels';
const base: NovelRecord = { id: 'a', owner_id: null, slug: 'a', title: 'Alpha', original_title: null, original_author: null, original_language: 'Chinese', translated_language: 'English', language_mode: 'dual', synopsis: null, cover_url: null, featured_image_url: null, category: 'Fantasy', genres: ['Fantasy'], tags: ['System'], status: 'ongoing', total_chapters: 500, rating: 4.5, reviews_count: 2, weekly_views: 10, view_count: 20, created_at: '2026-11-01', updated_at: '2026-11-25' };
const other = { ...base, id: 'b', title: 'Beta', total_chapters: 300, rating: 0, reviews_count: 0, tags: ['Harem'], original_language: 'Korean', updated_at: '2026-10-01' };
describe('robust Browse filters', () => {
  it('supports original minimum chapter presets', () => { for (const min of [100, 300, 500, 1000]) expect(filterBrowseNovels([base, other], { min }).map(n => n.id)).toEqual(min <= 300 ? ['a', 'b'] : min === 500 ? ['a'] : []); });
  it('includes genres and excludes tags independently', () => expect(filterBrowseNovels([base, other], { genre: 'Fantasy', excludeTag: 'Harem' }).map(n => n.id)).toEqual(['a']));
  it('does not match a genre against tags', () => expect(filterBrowseNovels([base], { genre: 'System' })).toEqual([]));
  it('filters on reader rating only', () => expect(filterBrowseNovels([base, { ...other, rating: 5 }], { rating: 4 }).map(n => n.id)).toEqual(['a']));
  it('filters update age', () => expect(filterBrowseNovels([base, other], { days: 7 }, Date.parse('2026-11-25')).map(n => n.id)).toEqual(['a']));
  it('filters original language', () => expect(filterBrowseNovels([base, other], { origin: 'Korean' }).map(n => n.id)).toEqual(['b']));
  it('keeps filters through URL validation and rejects invalid values', () => expect(validateBrowseSearch({ genre: 'Fantasy', min: '500', days: '7', rating: '4.5', origin: 'Chinese', status: 'invalid', sort: 'invalid', page: -1 })).toEqual({ genre: 'Fantasy', origin: 'Chinese', min: 500, days: 7, rating: 4.5 }));
  it('sorts by chapter count', () => expect(filterBrowseNovels([other, base], { sort: 'chapters' }).map(n => n.id)).toEqual(['a', 'b']));
});
