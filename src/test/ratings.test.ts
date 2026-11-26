import { expect, it } from 'vitest';
import { readerRating } from '../lib/ratings';
it('never treats a novel with zero reader reviews as rated', () => expect(readerRating({ rating: 4.5, reviews_count: 0 })).toBeNull());
it('uses the reader average when reviews exist', () => expect(readerRating({ rating: 3.75, reviews_count: 4 })).toBe(3.75));